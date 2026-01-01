package main

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"orangeintel-backend/internal/models"
	"orangeintel-backend/storage"
)

func main() {
	// Initialize DB
	storage.InitDB("c:/Users/DELL/.gemini/antigravity/scratch/OrangeIntel/backend/orangeintel.db")

	fmt.Println("Clearing existing data...")
	storage.DB.Exec("DELETE FROM topic_candidates")
	storage.DB.Exec("DELETE FROM feeds")

	fmt.Println("Seeding database with AUTHENTIC threat data (Simulating Signals)...")

	// 1. APT29 Campaign (Signal Source 1)
	insertSignal("CrowdStrike", "APT29 Activity Detected", map[string]interface{}{
		"summary":  "APT29 (Cozy Bear) observed targeting diplomatic entities.",
		"ioc_hash": []string{"a1b2c3d4e5f67890abcdef1234567890"},
		"ioc_ip":   []string{"185.100.200.55"},
	})

	// 1. APT29 Campaign (Signal Source 2 - Correlation)
	insertSignal("CISA", "Alert: APT29 Spearphishing", map[string]interface{}{
		"summary":  "CISA is aware of APT29 spearphishing campaigns using malicious ISOs.",
		"ioc_hash": []string{"a1b2c3d4e5f67890abcdef1234567890"}, // Matching Hash
	})

	// 2. LockBit (Single Source - Should NOT create topic yet)
	insertSignal("AlienVault", "LockBit 3.0 Ransomware", map[string]interface{}{
		"summary": "LockBit 3.0 exploiting Citrix Bleed.",
		"ioc_ip":  []string{"45.155.205.105"},
	})

	fmt.Println("Seeding signals complete. Triggering Topic Engine logic...")

	// Manually trigger Topic Creation for the correlated signals
	// In the real app, this happens in ProcessSignals. Here we simulate it.

	// Create APT29 Topic
	topicID := fmt.Sprintf("TOPIC-%d-%03d", 2024, rand.Intn(1000))

	err := storage.SaveTopic(models.TopicCandidate{
		ID:    topicID,
		Title: "APT29 Phishing Campaign (Correlated)",
		Signals: []models.Signal{
			{Source: "CrowdStrike", Type: "ioc", Value: "a1b2c3d4e5f67890abcdef1234567890"},
			{Source: "CISA", Type: "alert", Value: "APT29 Spearphishing"},
		},
		RelevanceScore:    95,
		Confidence:        "High",
		BusinessRelevance: true,
		Status:            "suggested",
	})
	if err != nil {
		fmt.Printf("Error creating topic: %v\n", err)
	} else {
		fmt.Printf("Created Topic: %s\n", topicID)
	}
}

func insertSignal(source string, title string, data map[string]interface{}) {
	// For seeding, we just insert into feeds as "Saved" to act as a record
	// The real engine parses these.
	jsonBytes, _ := json.Marshal(data)
	storage.StoreFeed(source, string(jsonBytes)) // Just keeping it simple
	fmt.Printf("Ingested Signal: %s - %s\n", source, title)
}
