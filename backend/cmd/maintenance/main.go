package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "modernc.org/sqlite"
)

func main() {
	fmt.Println("Starting Database Maintenance...")
	db, err := sql.Open("sqlite", "./orangeintel.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err = db.Ping(); err != nil {
		log.Fatal(err)
	}

	// 1. Check Row Counts
	var feedCount int
	db.QueryRow("SELECT COUNT(*) FROM feeds").Scan(&feedCount)
	fmt.Printf("Feeds Count: %d\n", feedCount)

	// 2. Attempt WAL Checkpoint
	fmt.Println("Attempting WAL Checkpoint (TRUNCATE)... this might take a while...")
	_, err = db.Exec("PRAGMA wal_checkpoint(TRUNCATE);")
	if err != nil {
		log.Printf("Checkpoint failed: %v", err)
	} else {
		fmt.Println("Checkpoint successful.")
	}

	// 3. Check Row Counts again
	db.QueryRow("SELECT COUNT(*) FROM feeds").Scan(&feedCount)
	fmt.Printf("Feeds Count after checkpoint: %d\n", feedCount)
}
