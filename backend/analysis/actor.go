package analysis

import (
	"strings"
)

type ActorAttributor struct{}

func NewActorAttributor() *ActorAttributor {
	return &ActorAttributor{}
}

func (a *ActorAttributor) Name() string {
	return "Threat Actor Attribution"
}

// Attribute attempts to link IOCs/TTPs to a known actor.
func (a *ActorAttributor) Attribute(content string, techniques []MitreTechnique) ActorProfile {
	lower := strings.ToLower(content)

	if strings.Contains(lower, "wizard spider") || strings.Contains(lower, "ryuk") {
		return ActorProfile{
			Name:          "Wizard Spider",
			Origin:        "Russia",
			Motivations:   []string{"Financial gain"},
			AssociatedTTP: []string{"Ryuk", "TrickBot"},
		}
	}

	if strings.Contains(lower, "apt28") || strings.Contains(lower, "fancy bear") {
		return ActorProfile{
			Name:          "APT28 (Fancy Bear)",
			Origin:        "Russia",
			Motivations:   []string{"Espionage", "Political disruption"},
			AssociatedTTP: []string{"XAgent", "XTunnel"},
		}
	}

	if strings.Contains(lower, "lazarus") {
		return ActorProfile{
			Name:          "Lazarus Group",
			Origin:        "North Korea",
			Motivations:   []string{"Financial gain", "Espionage"},
			AssociatedTTP: []string{"Manuscrypt", "NukeSped"},
		}
	}

	// Heuristic attribution based on TTPs
	for _, tech := range techniques {
		if tech.ID == "T1486" { // Data Encrypted for Impact (Ransomware)
			return ActorProfile{
				Name:          "Unattributed Ransomware Group",
				Motivations:   []string{"Financial gain"},
				AssociatedTTP: []string{"Ransomware"},
			}
		}
	}

	return ActorProfile{Name: "Unknown"}
}
