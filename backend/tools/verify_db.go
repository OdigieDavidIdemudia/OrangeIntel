package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "modernc.org/sqlite"
)

func main() {
	// Open the database in read-only mode to avoid locking issues
	// Assumes running from backend/ directory
	db, err := sql.Open("sqlite", "./orangeintel.db?mode=ro")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	var feedCount int
	err = db.QueryRow("SELECT COUNT(*) FROM feeds").Scan(&feedCount)
	if err != nil {
		log.Fatal("Error counting feeds:", err)
	}

	fmt.Printf("Total Feeds: %d\n", feedCount)

	// Breakdown by Source
	rows, err := db.Query("SELECT source, COUNT(*) FROM feeds GROUP BY source")
	if err != nil {
		log.Fatal("Error grouping feeds:", err)
	}
	defer rows.Close()

	fmt.Println("\nFeed Breakdown:")
	for rows.Next() {
		var source string
		var count int
		if err := rows.Scan(&source, &count); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("- %s: %d\n", source, count)
	}

	var analysisCount int
	err = db.QueryRow("SELECT COUNT(*) FROM analysis_results").Scan(&analysisCount)
	if err != nil {
		log.Fatal("Error counting analysis results:", err)
	}
	fmt.Printf("\nTotal Analysis Results: %d\n", analysisCount)
}
