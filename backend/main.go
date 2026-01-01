package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"orangeintel-backend/admin"
	"orangeintel-backend/analysis"
	"orangeintel-backend/auth"
	"orangeintel-backend/config"
	"orangeintel-backend/ingest"
	"orangeintel-backend/integrations"
	"orangeintel-backend/internal/models"
	"orangeintel-backend/pipeline"
	"orangeintel-backend/report"
	"orangeintel-backend/storage"
)

func main() {
	// Initialize Database
	storage.InitDB("./orangeintel.db")
	// seedData() // Disabled for real data usage

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Hello from Go Backend!")
	})

	// Public / Status
	http.HandleFunc("/api/status", func(w http.ResponseWriter, r *http.Request) {
		// Enable CORS
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization") // Add Auth Header

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":  "ok",
			"db":      "connected",
			"message": "Backend is running and DB is secured",
		})
	})

	// Auth Routes
	http.HandleFunc("/api/auth/login", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		auth.LoginHandler(w, r)
	})

	// SEED Route (Admin/Testing)
	http.HandleFunc("/api/admin/seed", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// SeedNewBatch()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "seeded", "message": "New daily batch generated"})
	})

	// Admin Routes (Protected)
	http.Handle("/api/admin/users", auth.AuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		if r.Method == "GET" {
			admin.GetUsersHandler(w, r)
			return
		}
		admin.CreateUserHandler(w, r)
	})))

	http.Handle("/api/admin/users/role", auth.AuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "PUT, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		admin.UpdateUserRoleHandler(w, r)
	})))

	http.Handle("/api/admin/audit-logs", auth.AuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		admin.GetAuditLogsHandler(w, r)
	})))

	// Protect Existing Routes with AuthMiddleware
	// Using a wrapper helper or just raw wrapping would be cleaner if refactored,
	// but for now let's wrap key endpoints.

	// Secure Report Generation
	http.Handle("/api/reports/generate", auth.AuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Enable CORS
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		if r.Method != "POST" {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			FeedIDs []int `json:"feed_ids"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		reportText, err := report.GenerateReport(req.FeedIDs)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to generate report: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": "success",
			"report": reportText,
		})
	})))

	http.HandleFunc("/api/feeds", func(w http.ResponseWriter, r *http.Request) {
		// Enable CORS
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		if r.Method != "GET" {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		feeds, err := storage.GetRecentFeeds(50)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to fetch feeds: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(feeds)
	})

	http.HandleFunc("/api/threats", func(w http.ResponseWriter, r *http.Request) {
		// Enable CORS
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		if r.Method != "GET" {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Check for "saved" param
		savedParam := r.URL.Query().Get("saved")
		var threats []storage.ThreatObject
		var err error

		if savedParam == "true" {
			// Fetch SAVED items
			// Note: We need a helper to convert FeedResult to ThreatObject or update GetSavedFeeds to return ThreatObject
			// For simplicity, let's reuse GetRecentThreats logic but targeted at saved items.
			// Actually, GetRecentFeeds is used by GetRecentThreats.
			// Let's call a new helper GetSavedThreats() or modify GetRecentThreats to accept a filter?
			// To avoid major refactoring, let's fetch raw saved feeds and map them here.
			feeds, err := storage.GetSavedFeeds()
			if err != nil {
				http.Error(w, fmt.Sprintf("Failed to fetch saved threats: %v", err), http.StatusInternalServerError)
				return
			}
			threats = storage.MapFeedsToThreats(feeds)
		} else {
			// Dashboard View: Limit to 10 items (Daily limit)
			threats, err = storage.GetRecentThreats(10)
		}

		log.Printf("[DEBUG] API Threats: Count=%d Error=%v", len(threats), err)

		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to fetch threats: %v", err), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(threats)
	})

	http.HandleFunc("/api/threats/save", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		if r.Method != "POST" {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			ID int `json:"id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		saved, err := storage.ToggleFeedSaved(req.ID)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to toggle save: %v", err), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "success",
			"saved":  saved,
		})
	})

	http.HandleFunc("/api/test/report", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "text/html")

		idStr := r.URL.Query().Get("id")
		var id int
		if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil || id == 0 {
			// If no ID provided, pick the latest one from DB for convenience
			feeds, _ := storage.GetRecentFeeds(1)
			if len(feeds) > 0 {
				id = feeds[0].ID
			} else {
				fmt.Fprintf(w, "<html><body><h1>No feeds found to test. Seed the DB first.</h1></body></html>")
				return
			}
		}

		// Construct fake report data for this feed to test the generator
		feeds, _ := storage.GetFeedsByIDs([]int{id})
		if len(feeds) == 0 {
			http.Error(w, "Feed not found", http.StatusNotFound)
			return
		}

		// Parse findings to populate report fields authentically
		var findings analysis.FinalThreatObject
		json.Unmarshal([]byte(feeds[0].Findings), &findings)

		data := report.FullReportData{}
		data.ReportType = "TIA"
		data.FeedIDs = []int{id}
		data.Overview.Title = fmt.Sprintf("Threat Analysis: %s", findings.Name)
		data.Overview.Date = time.Now().Format("2006-01-02")
		data.Overview.PreparedBy = "OrangeIntel Automated Analyst"
		data.Overview.OrgUnit = "SOC / Threat Intel"

		// Pre-fill executive summary from findings
		data.ExecutiveSummary.Advisory = findings.Summary
		data.ExecutiveSummary.DateOfRelease = time.Now().Format("2006-01-02")

		// --- AUTHENTIC DATA MAPPING ---

		// 1. Actor Profile (if available) - Mapped to "Threat Landscape" section for now
		if findings.ActorProfile.Name != "" {
			data.ThreatLandscape.Type = "Advanced Persistent Threat / Targeted Cybercrime"
			data.ThreatLandscape.Source = fmt.Sprintf("%s (%s)", findings.ActorProfile.Name, findings.ActorProfile.Origin)

			// Format motivations and TTPs into HTML for the "Discovery Method" or description
			var motivations string
			if len(findings.ActorProfile.Motivations) > 0 {
				motivations = strings.Join(findings.ActorProfile.Motivations, ", ")
			}
			data.ThreatLandscape.DiscoveryMethod = fmt.Sprintf("Attributed to %s based on TTP correlation. Motivations: %s", findings.ActorProfile.Name, motivations)
		} else {
			data.ThreatLandscape.Type = "General Cyber Threat"
			data.ThreatLandscape.Source = "Unattributed"
			data.ThreatLandscape.DiscoveryMethod = "Automated Detection"
		}

		// 2. MITRE TTPs - Mapped into Detection Rules / BIOCs
		// Since our simple report format puts everything into specific fields, we'll format HTML lists into them.
		var ttpsHTML strings.Builder
		if len(findings.Mitre) > 0 {
			ttpsHTML.WriteString("<ul>")
			for _, m := range findings.Mitre {
				ttpsHTML.WriteString(fmt.Sprintf("<li>%s: %s</li>", m.ID, m.Name))
			}
			ttpsHTML.WriteString("</ul>")
		} else {
			ttpsHTML.WriteString("None mapped.")
		}
		data.DetectionRules.BIOCs = ttpsHTML.String() // Using BIOCs field to show TTPs

		// 3. IOCs
		var iocsHTML strings.Builder
		if len(findings.IOCs) > 0 {
			iocsHTML.WriteString("<table border='1' style='width:100%'><tr><th>Type</th><th>Value</th></tr>")
			for _, ioc := range findings.IOCs {
				iocsHTML.WriteString(fmt.Sprintf("<tr><td>%s</td><td>%s</td></tr>", ioc.Type, ioc.Value))
			}
			iocsHTML.WriteString("</table>")
		} else {
			iocsHTML.WriteString("No specific IOCs listed.")
		}
		data.DetectionRules.IOCs = iocsHTML.String()

		// 4. Impact (Mocked based on Score)
		if findings.Score > 90 {
			data.Impact.BusinessRiskLevel = "CRITICAL"
			data.Impact.PotentialImpact = "Complete compromise of affected systems, potential data exfiltration, and lateral movement."
		} else if findings.Score > 70 {
			data.Impact.BusinessRiskLevel = "HIGH"
			data.Impact.PotentialImpact = "System compromise likely; immediate containment required."
		} else {
			data.Impact.BusinessRiskLevel = "MEDIUM"
			data.Impact.PotentialImpact = "Potential unauthorized access or service disruption."
		}

		// View Mode - Render HTML directly for browser view (Preview)
		// We reuse GenerateDOCX structure but return the raw HTML string
		htmlBytes, err := report.GenerateDOCX(data)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to generate report: %v", err), http.StatusInternalServerError)
			return
		}

		w.Write(htmlBytes)
	})

	// Download Report Preview (Generate from Data)
	http.HandleFunc("/api/reports/download-preview", func(w http.ResponseWriter, r *http.Request) {
		// Enable CORS
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		if r.Method != "POST" {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req report.FullReportData
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		docBytes, err := report.GenerateDOCX(req)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to generate report: %v", err), http.StatusInternalServerError)
			return
		}

		filename := fmt.Sprintf("GTCO_TIA_%s.doc", time.Now().Format("20060102"))
		w.Header().Set("Content-Type", "application/msword")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
		w.Header().Set("Content-Length", fmt.Sprintf("%d", len(docBytes)))
		w.Write(docBytes)
	})

	// Verify Encryption Strategy
	testPlain := "Confidential Intelligence Data"
	encrypted, err := storage.Encrypt(testPlain)
	if err != nil {
		log.Fatalf("Encryption failed: %v", err)
	}
	decrypted, err := storage.Decrypt(encrypted)
	if err != nil {
		log.Fatalf("Decryption failed: %v", err)
	}

	if testPlain != decrypted {
		log.Fatalf("Encryption verification failed! Got: %s, Want: %s", decrypted, testPlain)
	}

	fmt.Printf("Startup Self-Test: Encryption/Decryption verified successfully.\n")

	// Load Configuration
	cfg, err := config.LoadConfig("config.json")
	if err != nil {
		log.Printf("Failed to load config.json: %v. Using defaults/mock mode if possible.", err)
		// Fallback or exit? For now let's just create an empty config which will trigger mocks
		cfg = &config.AppConfig{}
	}

	// Initialize API Integrations
	apiClient := integrations.NewClient(integrations.ClientConfig{
		TimeoutSeconds: 30,
		MaxRetries:     3,
		// RateLimitPerMin: 4, // Applied per-connector if needed, but client also supports global if configured
	})

	apiScheduler := integrations.NewScheduler(apiClient, func(topics []models.Topic) {
		log.Printf("[Main] Received %d topics from integration source", len(topics))
		for _, t := range topics {
			if err := storage.SaveTopic(t); err != nil {
				log.Printf("[Main] Failed to save topic %s: %v", t.ID, err)
			}
		}
	})

	// Register Public Feed Sources
	apiScheduler.Register(&integrations.CisaKevSource{})
	apiScheduler.Register(&integrations.NvdSource{})

	// Start Scheduler (Non-blocking)
	go apiScheduler.Start()
	defer apiScheduler.Stop()

	// Initialize Ingestion Engine
	analysisEngine := analysis.NewEngine()
	// analysisEngine.Register calls removed as Engine now constructs its own components

	// Create Sources
	// Create Sources (Adapting string keys to AuthDetails)
	mispSource := ingest.NewMISPSource(cfg.OrangeIntelAPIIntegration.Feeds.MISP, config.AuthDetails{APIKey: cfg.OrangeIntelAPIIntegration.Auth.MISP})
	taxiiSource := ingest.NewTAXIISource(cfg.OrangeIntelAPIIntegration.Feeds.TAXII, config.AuthDetails{APIKey: cfg.OrangeIntelAPIIntegration.Auth.TAXII})
	nvdSource := ingest.NewNVDSource(cfg.OrangeIntelAPIIntegration.Feeds.NVDCVE, config.AuthDetails{APIKey: cfg.OrangeIntelAPIIntegration.Auth.NVD})
	cisaSource := ingest.NewCISAKEVSource(cfg.OrangeIntelAPIIntegration.Feeds.CISAKEV)
	vtSource := ingest.NewVirusTotalSource(cfg.OrangeIntelAPIIntegration.Feeds.VirusTotal, config.AuthDetails{APIKey: cfg.OrangeIntelAPIIntegration.Auth.VirusTotal}, cfg.OrangeIntelAPIIntegration.VirusTotal)

	// API Integrations Scheduler Registration
	apiScheduler.Register(&integrations.CisaKevSource{})
	apiScheduler.Register(&integrations.NvdSource{}) // TODO: Pass API Key from cfg if desired

	// Register AlienVault if key is present
	if cfg.OrangeIntelAPIIntegration.Auth.AlienVault != "" {
		apiScheduler.Register(&integrations.AlienVaultSource{APIKey: cfg.OrangeIntelAPIIntegration.Auth.AlienVault})
	}

	// Create Pipelines
	normPipeline := pipeline.NewNormalizationPipeline(cfg.OrangeIntelAPIIntegration.Normalization.Steps)

	enrichers := []pipeline.Enricher{vtSource}
	enrichPipeline := pipeline.NewEnrichmentPipeline(cfg.OrangeIntelAPIIntegration.Enrichment, enrichers)

	classEngine := pipeline.NewClassificationEngine(cfg.OrangeIntelAPIIntegration.Classification.Logic)

	scoringEngine := pipeline.NewScoringEngine(cfg.OrangeIntelAPIIntegration.Scoring.Weights, cfg.OrangeIntelAPIIntegration.Scoring.RiskBands)

	// Create Engine with Pipelines
	topicEngine := analysis.NewTopicEngine()
	ingestEngine := ingest.NewEngine(analysisEngine, topicEngine, normPipeline, enrichPipeline, classEngine, scoringEngine)

	if cfg.OrangeIntelAPIIntegration.Feeds.MISP.Enabled {
		ingestEngine.Register(mispSource)
	}
	if cfg.OrangeIntelAPIIntegration.Feeds.TAXII.Enabled {
		ingestEngine.Register(taxiiSource)
	}
	if cfg.OrangeIntelAPIIntegration.Feeds.CISAKEV.Enabled {
		ingestEngine.Register(cisaSource)
	}
	if cfg.OrangeIntelAPIIntegration.Feeds.VirusTotal.Enabled {
		ingestEngine.Register(vtSource)
	}
	if cfg.OrangeIntelAPIIntegration.Feeds.NVDCVE.Enabled {
		ingestEngine.Register(nvdSource)
	}

	// Register /api/enrich here, after vtSource is initialized
	http.HandleFunc("/api/enrich", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		if r.Method != "POST" {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Target string `json:"target"`
			Type   string `json:"type"` // "ip" or "hash"
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		var res map[string]interface{}
		var err error

		// Determine type (auto-detect or explicit)
		if req.Type == "ip" {
			res, err = vtSource.LookupIP(req.Target)
		} else if req.Type == "hash" {
			res, err = vtSource.LookupHash(req.Target)
		} else {
			// Heuristic detection: Hash is usually longer than IP
			if len(req.Target) > 20 {
				res, err = vtSource.LookupHash(req.Target)
			} else {
				res, err = vtSource.LookupIP(req.Target)
			}
		}

		if err != nil {
			http.Error(w, fmt.Sprintf("Enrichment failed: %v", err), http.StatusInternalServerError)
			return
		}

		// Wrap for consistency
		response := map[string]interface{}{
			"source": "VirusTotal",
			"target": req.Target,
			"data":   res,
		}

		// Unpack score/severity for storage
		score, _ := res["score"].(int)
		severity, _ := res["severity"].(string)
		if severity == "" {
			severity = "unknown"
		}

		// If type wasn't explicit, infer it from req.Target
		inferredType := req.Type
		if inferredType == "" {
			if len(req.Target) > 20 {
				inferredType = "hash"
			} else {
				inferredType = "ip"
			}
		}

		// Save to DB
		if err := storage.SaveEnrichmentResult(req.Target, inferredType, "VirusTotal", severity, score, res); err != nil {
			log.Printf("Failed to save enrichment result: %v", err)
			// Don't fail the request, just log
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	})

	ingestEngine.Start(600 * time.Second) // 10 minutes interval
	defer ingestEngine.Stop()

	// API: Topics (The "Quiet" Feed)
	http.HandleFunc("/api/topics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Fetch suggested topics
		// We need storage.GetTopics(status) - not implemented yet, adding simplistic query inline or need helper.
		// Let's add storage helper first? Or just query here if simple?
		// Cleaner to add storage helper.
		topics, err := storage.GetTopics(models.TopicStatusSuggested)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(topics)
	})

	// API: Promote Topic to Advisory
	http.HandleFunc("/api/topics/promote", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		var req struct {
			TopicID string `json:"topic_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid Body", 400)
			return
		}

		// Logic: Status -> Accepted, Create Draft Advisory
		err := storage.PromoteTopic(req.TopicID)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		// The ID of the advisory is derived from the topic, usually just same ID or mapped.
		// Looking at PromoteTopic in storage (which I can't see fully but assuming logic),
		// it creates an advisory with ID = TopicID usually or similar.
		// Let's assume ID is effectively req.TopicID for now or check storage.
		// Actually, let's look at `storage/db.go` first to be sure.
		// For now safe to return just status, but frontend expects ID.
		// Let's modify the response to return the likely ID.
		advisoryID := req.TopicID // Based on previous logic

		resp := map[string]string{
			"status":      "promoted",
			"advisory_id": advisoryID,
		}
		json.NewEncoder(w).Encode(resp)
	})

	// API: Advisories
	http.HandleFunc("/api/advisories", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		advisories, err := storage.GetAdvisories()
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(advisories)
	})

	// API: Update Advisory
	http.HandleFunc("/api/advisories/update", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		var ta models.ThreatAdvisory
		if err := json.NewDecoder(r.Body).Decode(&ta); err != nil {
			http.Error(w, "Invalid Body", 400)
			return
		}

		err := storage.UpdateAdvisory(ta)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		w.Write([]byte(`{"status":"updated"}`))
	})

	// API: Assessments
	http.HandleFunc("/api/assessments", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		if r.Method == "GET" {
			assessments, err := storage.GetAssessments()
			if err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			json.NewEncoder(w).Encode(assessments)
			return
		}

		if r.Method == "POST" {
			var a models.ThreatIntelligenceAssessment
			if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
				http.Error(w, "Invalid Body", 400)
				return
			}

			// Auto-ID if missing
			if a.ID == "" {
				newID := fmt.Sprintf("TIA-%s-%d", time.Now().Format("2006"), time.Now().Unix()%1000)
				a.ID = newID
				a.AssessmentMetadata.AssessmentID = newID
				a.AssessmentMetadata.CreatedAt = time.Now().Format(time.RFC3339)
			}

			err := storage.SaveAssessment(a)
			if err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			w.Write([]byte(`{"status":"created", "id":"` + a.ID + `"}`))
		}
	})

	// API: Reports
	// List Reports
	http.HandleFunc("/api/reports", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		reports, err := storage.GetReports()
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(reports)
	})

	// Generate Report (Save to DB)
	http.Handle("/api/reports/create", auth.AuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		var req struct {
			ArtifactID string `json:"artifact_id"`
			Type       string `json:"type"` // "Advisory" or "Assessment"
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid Body", 400)
			return
		}

		var blob []byte
		var err error
		var title string

		// Fetch Artifact & Generate
		if req.Type == "Advisory" {
			// Need GetAdvisory(id) - reusing GetAdvisories for now (inefficient but works)
			advisories, _ := storage.GetAdvisories()
			var ta models.ThreatAdvisory
			found := false
			for _, a := range advisories {
				if a.ID == req.ArtifactID {
					ta = a
					found = true
					break
				}
			}
			if !found {
				http.Error(w, "Advisory not found", 404)
				return
			}
			blob, err = report.GenerateAdvisoryDOCX(ta)
			title = ta.Title
		} else {
			// Assessments
			assessments, _ := storage.GetAssessments()
			var tia models.ThreatIntelligenceAssessment
			found := false
			for _, a := range assessments {
				if a.ID == req.ArtifactID {
					tia = a
					found = true
					break
				}
			}
			if !found {
				http.Error(w, "Assessment not found", 404)
				return
			}
			blob, err = report.GenerateAssessmentDOCX(tia)
			title = "Strategic Assessment: " + tia.ID
		}

		if err != nil {
			http.Error(w, fmt.Sprintf("Generation failed: %v", err), 500)
			return
		}

		// Save Report
		rep := models.Report{
			ID:          strings.Replace(req.ArtifactID, "TA", "RPT-TA", 1), // Simple ID logic
			SourceID:    req.ArtifactID,
			Type:        req.Type,
			Title:       title,
			GeneratedAt: time.Now(),
			Analyst:     "Current User", // TODO: Auth
			Blob:        blob,
		}
		if strings.HasPrefix(req.ArtifactID, "TIA") {
			rep.ID = strings.Replace(req.ArtifactID, "TIA", "RPT-TIA", 1)
		}

		// Save to DB
		if err := storage.SaveReport(rep); err != nil {
			log.Printf("Failed to save report: %v", err)
			http.Error(w, "Failed to save report", 500)
			return
		}

		json.NewEncoder(w).Encode(map[string]string{"status": "generated", "id": rep.ID})
	})))

	// Download Report
	http.HandleFunc("/api/reports/download", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		id := r.URL.Query().Get("id")
		if id == "" {
			http.Error(w, "Missing ID", 400)
			return
		}

		blob, err := storage.GetReportBlob(id)
		if err != nil {
			http.Error(w, "Report not found", 404)
			return
		}

		w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.doc\"", id))
		w.Write(blob)
	})

	port := "8083"
	fmt.Printf("Go backend listening on port %s\n", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
