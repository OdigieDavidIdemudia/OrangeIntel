package models

import "time"

// Role constants
const (
	RoleSuperAdmin   = "SuperAdmin"
	RoleAdmin        = "Admin"
	RoleSOCTIAnalyst = "SOCTI_Analyst"
)

// User represents a system user
type User struct {
	ID           int       `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"` // Never return password hash in JSON
	Role         string    `json:"role"`
	MFAEnabled   bool      `json:"mfa_enabled"`
	MFASecret    string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
	LastLoginAt  time.Time `json:"last_login_at"`
}

// LoginRequest for auth payload
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}
