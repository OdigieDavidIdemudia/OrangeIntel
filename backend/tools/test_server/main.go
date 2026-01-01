package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func InitDB() {
	var err error
	DB, err = sql.Open("sqlite", "./test_system.db") // Will create in CWD (backend/)
	if err != nil {
		log.Fatal(err)
	}

	query := `
	CREATE TABLE IF NOT EXISTS feeds (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		source TEXT,
		content TEXT,
		fetched_at DATETIME,
		is_saved INTEGER DEFAULT 0
	);
	`
	if _, err := DB.Exec(query); err != nil {
		log.Fatal(err)
	}
	log.Println("Test Database Initialized.")
}

func main() {
	InitDB()

	// Serve Frontend
	// Assuming CWD is 'backend/', frontend is at '../test_system/frontend'
	frontendPath, _ := filepath.Abs("../test_system/frontend")
	log.Printf("Serving frontend from: %s", frontendPath)
	fs := http.FileServer(http.Dir(frontendPath))
	http.Handle("/", fs)

	// API Endpoints
	http.HandleFunc("/api/dashboard", handleDashboard)
	http.HandleFunc("/api/saved", handleSaved)
	http.HandleFunc("/api/save", handleToggleSave)
	http.HandleFunc("/api/ingest", handleIngest)
	http.HandleFunc("/api/cleanup", handleCleanup)

	log.Println("Test Server running on http://localhost:8090")
	log.Fatal(http.ListenAndServe(":8090", nil))
}

// Models
type FeedItem struct {
	ID        int    `json:"id"`
	Source    string `json:"source"`
	Content   string `json:"content"`
	FetchedAt string `json:"fetched_at"`
	IsSaved   bool   `json:"is_saved"`
}

// Handlers

func handleDashboard(w http.ResponseWriter, r *http.Request) {
	// Return top 10 most recent items (regardless of saved status, simulating dashboard view)
	rows, err := DB.Query("SELECT id, source, content, fetched_at, is_saved FROM feeds ORDER BY fetched_at DESC LIMIT 10")
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	defer rows.Close()

	items := scanFeeds(rows)
	jsonResponse(w, items)
}

func handleSaved(w http.ResponseWriter, r *http.Request) {
	// Return ALL saved items
	rows, err := DB.Query("SELECT id, source, content, fetched_at, is_saved FROM feeds WHERE is_saved = 1 ORDER BY fetched_at DESC")
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	defer rows.Close()

	items := scanFeeds(rows)
	jsonResponse(w, items)
}

func handleToggleSave(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", 405)
		return
	}
	var req struct {
		ID int `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	// Toggle is_saved
	_, err := DB.Exec("UPDATE feeds SET is_saved = NOT is_saved WHERE id = ?", req.ID)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	jsonResponse(w, map[string]string{"status": "ok"})
}

func handleIngest(w http.ResponseWriter, r *http.Request) {
	// Generate mock data:
	// 5 items that are "new" (fetched now)
	// 5 items that are "old" (fetched 7 hours ago)

	// New
	for i := 0; i < 5; i++ {
		_, err := DB.Exec("INSERT INTO feeds (source, content, fetched_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
			fmt.Sprintf("New Source %d", i), fmt.Sprintf("New Content %d", i))
		if err != nil {
			log.Println("Error inserting new:", err)
		}
	}

	// Old (7 hours ago)
	// SQLite's CURRENT_TIMESTAMP is UTC.
	oldTime := time.Now().UTC().Add(-7 * time.Hour).Format("2006-01-02 15:04:05")
	for i := 0; i < 5; i++ {
		_, err := DB.Exec("INSERT INTO feeds (source, content, fetched_at) VALUES (?, ?, ?)",
			fmt.Sprintf("Old Source %d", i), fmt.Sprintf("Old Content %d", i), oldTime)
		if err != nil {
			log.Println("Error inserting old:", err)
		}
	}

	jsonResponse(w, map[string]string{"status": "ingested 10 items"})
}

func handleCleanup(w http.ResponseWriter, r *http.Request) {
	// Delete items older than 6 hours AND NOT saved
	// SQLite modifier: datetime(fetched_at) < datetime('now', '-6 hours')
	res, err := DB.Exec("DELETE FROM feeds WHERE fetched_at < datetime('now', '-6 hours') AND is_saved = 0")
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	count, _ := res.RowsAffected()
	jsonResponse(w, map[string]interface{}{"status": "cleanup complete", "deleted": count})
}

// Helpers
func scanFeeds(rows *sql.Rows) []FeedItem {
	var items []FeedItem
	for rows.Next() {
		var i FeedItem
		var isSavedInt int
		if err := rows.Scan(&i.ID, &i.Source, &i.Content, &i.FetchedAt, &isSavedInt); err != nil {
			continue
		}
		i.IsSaved = isSavedInt == 1
		items = append(items, i)
	}
	if items == nil {
		items = []FeedItem{}
	}
	return items
}

func jsonResponse(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}
