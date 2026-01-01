package analysis

import (
	"strings"
)

type MitreAnalyzer struct {
	// Map keyword -> T-Code ID and Name
	Mappings map[string]MitreInfo
}

type MitreInfo struct {
	ID   string
	Name string
}

func NewMitreAnalyzer() *MitreAnalyzer {
	return &MitreAnalyzer{
		Mappings: map[string]MitreInfo{
			"phishing":            {ID: "T1566", Name: "Phishing"},
			"spearphish":          {ID: "T1566.001", Name: "Spearphishing Attachment"},
			"powershell":          {ID: "T1059.001", Name: "PowerShell"},
			"ransomware":          {ID: "T1486", Name: "Data Encrypted for Impact"},
			"command and control": {ID: "T1071", Name: "Application Layer Protocol"},
			"c2":                  {ID: "T1071", Name: "Application Layer Protocol"},
			"credential":          {ID: "T1555", Name: "Credentials from Password Stores"},
			"brute force":         {ID: "T1110", Name: "Brute Force"},
		},
	}
}

func (m *MitreAnalyzer) Name() string {
	return "MITRE ATT&CK Analyzer"
}

func (m *MitreAnalyzer) Analyze(content string) []MitreTechnique {
	matches := []MitreTechnique{}
	lowerContent := strings.ToLower(content)

	for keyword, info := range m.Mappings {
		if strings.Contains(lowerContent, keyword) {
			matches = append(matches, MitreTechnique{
				ID:   info.ID,
				Name: info.Name,
			})
		}
	}
	return matches
}
