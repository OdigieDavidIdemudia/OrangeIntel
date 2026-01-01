package auth

import (
	"encoding/json"
	"net/http"
	"orangeintel-backend/internal/models"
	"orangeintel-backend/storage"
)

// LoginHandler is a stub/mock login
func LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid Body", 400)
		return
	}

	// Mock Logic: Check against DB, but password check is "dummy"
	user, err := storage.GetUserByUsername(req.Username)
	if err != nil {
		http.Error(w, "Invalid Credentials", 401)
		return
	}

	// "Not functional yet" - We don't check password hash or create real session
	// Just return success if user exists
	token, _ := GenerateToken(*user)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"token":  token,
		"user":   user,
		"note":   "Login is currently in MOCK mode.",
	})
}
