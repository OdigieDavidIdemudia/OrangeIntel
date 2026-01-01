package admin

import (
	"encoding/json"
	"net/http"
	"orangeintel-backend/internal/models"
	"orangeintel-backend/storage"
	"strconv"
	"strings"
)

// CreateUserHandler handles user creation (Admin only)
func CreateUserHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Username string `json:"username"`
		Password string `json:"password"` // In real app, enforce complexity
		Role     string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid Body", 400)
		return
	}

	// Basic validation
	if req.Username == "" || req.Password == "" {
		http.Error(w, "Username and Password required", 400)
		return
	}

	// Default role
	if req.Role == "" {
		req.Role = models.RoleSOCTIAnalyst
	}

	// Create User
	// TODO: Hash password properly. For now, using simple placeholder hash or plain for demo (as requested not functional yet)
	// User asked for "implement it but it shouldnt be functional yet" - leaving password storage simplistic/mocked or TODO.
	passwordHash := "HASH:" + req.Password

	user := models.User{
		Username:     req.Username,
		PasswordHash: passwordHash,
		Role:         req.Role,
	}

	id, err := storage.CreateUser(user)
	if err != nil {
		http.Error(w, "Failed to create user: "+err.Error(), 500)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"status": "created", "id": id})
}

// UpdateUserRoleHandler handles role updates
func UpdateUserRoleHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "PUT" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract ID from URL (naive path parsing or query param)
	// Assuming /api/admin/users/{id} logic handled in main via stripping prefix or using query param for simplicity now
	// Let's use Query param for simplicity to avoid complex routing in main.go stdlib
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		// Try parsing path if query missing (e.g. if main.go uses StripPrefix)
		parts := strings.Split(r.URL.Path, "/")
		if len(parts) > 0 {
			idStr = parts[len(parts)-1]
		}
	}

	id, err := strconv.Atoi(idStr)
	if err != nil || id == 0 {
		http.Error(w, "Invalid User ID", 400)
		return
	}

	var req struct {
		Role string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid Body", 400)
		return
	}

	if err := storage.UpdateUserRole(id, req.Role); err != nil {
		http.Error(w, "Failed to update role: "+err.Error(), 500)
		return
	}

	w.Write([]byte(`{"status":"updated"}`))
}
