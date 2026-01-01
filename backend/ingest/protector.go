package ingest

import (
	"database/sql"
	"log"
	"os"
)

const MaxWALSize = 512 * 1024 * 1024 // 512 MB

// IsSafeToIngest checks if the database is in a healthy state for writing
func IsSafeToIngest(dbPath string) bool {
	walPath := dbPath + "-wal"
	info, err := os.Stat(walPath)
	if os.IsNotExist(err) {
		return true // No WAL means DB is likely idle/safe
	}
	if err != nil {
		log.Printf("[Protector] Error checking WAL size: %v", err)
		return true // Fail open? Or fail closed? Let's fail open to keep running but log/alert
	}

	if info.Size() > MaxWALSize {
		log.Printf("[Protector] WAL size critical! (%d bytes). Pausing ingestion.", info.Size())
		return false
	}
	return true
}

// EnforceCheckpoint checks WAL size and forces a checkpoint if needed
func EnforceCheckpoint(db *sql.DB, dbPath string) {
	walPath := dbPath + "-wal"
	info, err := os.Stat(walPath)
	if os.IsNotExist(err) {
		return
	}

	// Warning threshold: 200MB (Max is 512MB)
	if info.Size() > 200*1024*1024 {
		log.Printf("[Protector] WAL size high (%d bytes). Enforcing checkpoint...", info.Size())
		_, err := db.Exec("PRAGMA wal_checkpoint(TRUNCATE);")
		if err != nil {
			log.Printf("[Protector] Checkpoint failed: %v", err)
		} else {
			log.Println("[Protector] Checkpoint complete. WAL truncated.")
		}
	}
}
