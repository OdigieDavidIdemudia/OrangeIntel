package integrations

import (
	"log"
	"sync"
	"time"

	"orangeintel-backend/internal/models"
)

// IngestCallback is a function that handles the normalized topics (e.g., saves them to DB)
type IngestCallback func(topics []models.Topic)

// Scheduler manages the periodic fetching of intelligence sources
type Scheduler struct {
	sources  []Source
	client   *Client
	onIngest IngestCallback
	stopCh   chan struct{}
	wg       sync.WaitGroup
}

// NewScheduler creates a scheduler with a configured global client
func NewScheduler(client *Client, callback IngestCallback) *Scheduler {
	return &Scheduler{
		sources:  make([]Source, 0),
		client:   client,
		onIngest: callback,
		stopCh:   make(chan struct{}),
	}
}

// Register adds a source to the scheduler
func (s *Scheduler) Register(source Source) {
	s.sources = append(s.sources, source)
	log.Printf("[Scheduler] Registered source: %s (Interval: %v)", source.Name(), source.Interval())
}

// Start begins the polling loops for all registered sources
func (s *Scheduler) Start() {
	log.Println("[Scheduler] Starting ingestion loops...")

	for _, source := range s.sources {
		s.wg.Add(1)
		go s.runLoop(source)
	}
}

func (s *Scheduler) runLoop(source Source) {
	defer s.wg.Done()

	// Initial fetch immediately on start
	s.triggerFetch(source)

	ticker := time.NewTicker(source.Interval())
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.triggerFetch(source)
		case <-s.stopCh:
			log.Printf("[Scheduler] Stopping loop for %s", source.Name())
			return
		}
	}
}

// TriggerFetch manually triggers an ingestion for a specific source
func (s *Scheduler) triggerFetch(source Source) {
	log.Printf("[Scheduler] Fetching from %s...", source.Name())

	topics, err := source.Fetch(s.client)
	if err != nil {
		log.Printf("[Scheduler] Error fetching %s: %v", source.Name(), err)
		return
	}

	if len(topics) > 0 {
		log.Printf("[Scheduler] %s returned %d topics. Processing...", source.Name(), len(topics))
		s.onIngest(topics)
	} else {
		log.Printf("[Scheduler] %s returned 0 topics.", source.Name())
	}
}

// Stop gracefully shuts down all polling loops
func (s *Scheduler) Stop() {
	close(s.stopCh)
	s.wg.Wait()
	log.Println("[Scheduler] All loops stopped.")
}
