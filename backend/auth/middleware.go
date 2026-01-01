package auth

import (
	"context"
	"net/http"

	"orangeintel-backend/internal/models"
)

// ContextKey for User
type ContextKey string

const UserKey ContextKey = "user"

// AuthMiddleware is a scaffold.
// It currently ALLOWS ALL requests but sets a dummy user in context if not present.
// In future, it will verify JWT/Session.
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Bypass implementation:
		// Check for specific headers or token, but for now, we just pass through.
		// We can inject a "Guest" or "Dev" user for testing if needed.

		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			// In a real app, strict mode would return 401 here.
			// w.WriteHeader(http.StatusUnauthorized)
			// return
		}

		// Mock User for Context
		user := models.User{
			ID:       1,
			Username: "dev_analyst",
			Role:     models.RoleSOCTIAnalyst,
		}

		ctx := context.WithValue(r.Context(), UserKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// AdminMiddleware enforces Admin role.
// Currently DISABLED (Pass-through).
func AdminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Mock check
		/*
			user, ok := r.Context().Value(UserKey).(models.User)
			if !ok || (user.Role != models.RoleAdmin && user.Role != models.RoleSuperAdmin) {
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}
		*/
		next.ServeHTTP(w, r)
	})
}

// GenerateToken is a placeholder for JWT generation
func GenerateToken(user models.User) (string, error) {
	return "mock-jwt-token-" + user.Username, nil
}
