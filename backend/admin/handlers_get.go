package admin

import (
	"encoding/json"
	"net/http"
	"orangeintel-backend/storage"
)

// GetUsersHandler retrieves list of users
func GetUsersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	users, err := storage.GetUsers()
	if err != nil {
		http.Error(w, "Failed to fetch users: "+err.Error(), 500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// GetAuditLogsHandler retrieves audit logs
func GetAuditLogsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	logs, err := storage.GetAuditLogs(100) // Hardcoded limit for now
	if err != nil {
		http.Error(w, "Failed to fetch logs: "+err.Error(), 500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}
