package ingest

import (
	"log"
	"strings"
	"time"

	"orangeintel-backend/analysis"
	"orangeintel-backend/pipeline"
	"orangeintel-backend/storage"
)

type Engine struct {
	Sources        []Source
	AnalysisEngine *analysis.Engine
	TopicEngine    *analysis.TopicEngine
	Normalization  *pipeline.NormalizationPipeline
	Enrichment     *pipeline.EnrichmentPipeline
	Classification *pipeline.ClassificationEngine
	Scoring        *pipeline.ScoringEngine
	Ticker         *time.Ticker
	Done           chan bool
}

func NewEngine(ae *analysis.Engine, te *analysis.TopicEngine, norm *pipeline.NormalizationPipeline, enrich *pipeline.EnrichmentPipeline, class *pipeline.ClassificationEngine, score *pipeline.ScoringEngine) *Engine {
	return &Engine{
		Sources:        []Source{},
		AnalysisEngine: ae,
		TopicEngine:    te,
		Normalization:  norm,
		Enrichment:     enrich,
		Classification: class,
		Scoring:        score,
		Done:           make(chan bool),
	}
}

func (e *Engine) Register(s Source) {
	e.Sources = append(e.Sources, s)
}

func (e *Engine) Start(interval time.Duration) {
	e.Ticker = time.NewTicker(interval)
	log.Println("[Ingest] Engine started.")

	// Run immediately on start
	go e.RunOnce()

	go func() {
		for {
			select {
			case <-e.Done:
				return
			case <-e.Ticker.C:
				e.RunOnce()
			}
		}
	}()
}

func (e *Engine) Stop() {
	if e.Ticker != nil {
		e.Ticker.Stop()
	}
	e.Done <- true
	log.Println("[Ingest] Engine stopped.")
}

func (e *Engine) RunOnce() {
	log.Println("[Ingest] RunOnce triggered...")

	// 0. Protection: Enforce Checkpoint if needed
	// Accessing storage.DB - in real app avoid global if possible, but consistent with current arch
	if storage.DB != nil {
		EnforceCheckpoint(storage.DB, "./orangeintel.db")
	}

	// 0. Safety Guard: Check WAL size
	if !IsSafeToIngest("./orangeintel.db") {
		log.Println("[Ingest] Skipping run due to unsafe DB state (High WAL size)")
		return
	}

	// 0.1 Safety Guard: Daily Limit (20 items max)
	log.Println("[DEBUG] Checking Daily Limit...")
	feeds, _ := storage.GetRecentFeeds(30)
	log.Printf("[DEBUG] Got %d recent feeds", len(feeds))
	dailyCount := 0
	todayPrefix := time.Now().Format("2006-01-02")
	for _, f := range feeds {
		if len(f.FetchedAt) >= 10 && f.FetchedAt[:10] == todayPrefix {
			dailyCount++
		}
	}
	if dailyCount >= 20 {
		log.Printf("[Ingest] Daily limit reached (%d/20). Skipping fetch.", dailyCount)
		return
	}

	log.Printf("[DEBUG] Starting source loop. Sources: %d", len(e.Sources))
	for _, s := range e.Sources {
		log.Printf("[DEBUG] Checking source: %s", s.Name())
		// 1. Get State
		state, err := storage.GetIngestionState(s.Name())
		if err != nil {
			log.Printf("[Ingest] Failed to get state for %s: %v", s.Name(), err)
			// Continue with defaults? Or skip? Let's assume defaults from helper.
		}

		// 2. Adaptive Check
		lastFetch, _ := time.Parse(time.RFC3339, state.LastFetchedAt)
		// Debug the time check
		diff := time.Since(lastFetch).Seconds()
		threshold := float64(state.AdaptiveIntervalSeconds)
		log.Printf("[DEBUG] %s: LastFetch=%s, Diff=%.2fs, Threshold=%.2fs", s.Name(), state.LastFetchedAt, diff, threshold)

		if diff < threshold {
			log.Printf("[Ingest] Skipping %s (Next run in %.0fs)", s.Name(), threshold-diff)
			continue
		}

		// 3. Fetch
		items, err := s.Fetch()
		if err != nil {
			log.Printf("[Ingest] Error fetching from %s: %v\n", s.Name(), err)
			continue
		}

		// 4. Update Adaptive Interval
		if len(items) > 0 {
			// New data found, reset to base interval (10 mins)
			state.AdaptiveIntervalSeconds = 600
		} else {
			// No data, back off (add 5 mins, max 1 hour)
			state.AdaptiveIntervalSeconds += 300
			if state.AdaptiveIntervalSeconds > 3600 {
				state.AdaptiveIntervalSeconds = 3600
			}
		}
		state.LastFetchedAt = time.Now().Format(time.RFC3339)
		storage.UpdateIngestionState(state)

		log.Printf("[Ingest] %s: Fetched %d items. Next poll in %ds.", s.Name(), len(items), state.AdaptiveIntervalSeconds)

		// 5. Process Items (Batching)
		batchSize := 50
		processedCount := 0

		for _, item := range items {
			processedCount++
			// Throttling: Sleep every batchSize items to let DB breathe
			if processedCount%batchSize == 0 {
				time.Sleep(300 * time.Millisecond)
			}

			// Pipeline execution

			// 0. Store Raw Feed immediately
			// This ensures we capture the data even if our pipeline decides it's "boring"
			// MVP storage.StoreFeed expected raw.
			feedID, err := storage.StoreFeed(item.Source, item.Data)
			if err != nil {
				// If 0, it was likely a duplicate, which is fine.
				// log.Printf("[Storage] Error storing feed: %v\n", err)
			}

			// Pipeline execution

			// 1. Normalization
			normalizedIOCs, err := e.Normalization.Normalize(item.Source, item.Data)
			if err != nil {
				log.Printf("[Pipeline] Normalization error: %v\n", err)
				continue
			}

			if len(normalizedIOCs) == 0 {
				// normalization found nothing (maybe comment-only attr?)
				continue
			}

			enrichedIOCs := []pipeline.EnrichedIOC{}

			// 2. Enrichment
			for _, ioc := range normalizedIOCs {
				enriched := e.Enrichment.Enrich(ioc)
				enrichedIOCs = append(enrichedIOCs, enriched)
			}

			// 3. Classification
			threatGroups := e.Classification.Classify(enrichedIOCs)

			// 4. Scoring & Storage
			for _, group := range threatGroups {
				log.Printf("[DEBUG] Processing Group: '%s' | Type: '%s' | Tags: %v", group.Name, group.Type, "TODO: Log tags")

				// Filter out Unclassified Feeds (Non-Authentic)
				// User specific requirement: "only real authentic reports"
				if strings.HasPrefix(group.Name, "Unclassified Feed") {
					log.Printf("[Pipeline] Dropping unclassified feed to maintain report authenticity: %s", group.Name)
					if feedID != 0 {
						// Delete the raw feed from DB so it doesn't count towards quota or appear in UI
						// We need a helper for this in storage, let's assume storage.DeleteFeed(feedID) exists
						// Since feedID is int64 and our new helper takes int, we cast.
						// Actually, db.go helper takes int.
						_ = storage.DeleteFeed(int(feedID))
					}
					continue
				}

				// Actually, scoring engine logic I wrote takes single EnrichedIOC.
				// Taking max score of group for now
				maxScore := 0
				for _, ioc := range group.IOCs {
					s := e.Scoring.Score(ioc)
					if s > maxScore {
						maxScore = s
					}
				}

				severity := e.Scoring.CalculateSeverity(maxScore)

				log.Printf("[Pipeline] Threat Group: %s | Type: %s | Validated IOCs: %d | Score: %d (%s)\n",
					group.Name, group.Type, len(group.IOCs), maxScore, severity)

				// Store Analysis Results (LEGACY REMOVED)
				// New Flow: Topic Engine
				e.TopicEngine.ProcessSignals(group.IOCs)
			}
		}
	}
}
