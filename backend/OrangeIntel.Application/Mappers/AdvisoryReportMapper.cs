using OrangeIntel.Application.DTOs.Reporting;
using OrangeIntel.Domain.Entities;

namespace OrangeIntel.Application.Mappers;

public static class AdvisoryReportMapper
{
    public static GTBankAdvisoryReportV1 MapToAdvisoryReportModel(Advisory advisory, string preparedBy, string reviewedBy)
    {
        var model = new GTBankAdvisoryReportV1();
        
        model.Metadata = new MetadataV1
        {
            Title = advisory.Title,
            Date = DateTime.UtcNow.ToString("yyyy-MM-dd"),
            PreparedBy = preparedBy,
            ReviewedBy = reviewedBy,
            Tlp = advisory.Classification.Contains("RED") ? "RED" : advisory.Classification.Contains("AMBER") ? "AMBER" : "GREEN",
            Classification = advisory.Classification.ToUpper()
        };

        model.ExecutiveSummary = new ExecutiveSummaryV1
        {
            Body = advisory.ExecutiveSummary
        };

        model.ThreatAnalysis = new ThreatAnalysisV1
        {
            Intro = advisory.TechnicalDetails.Length > 500 ? advisory.TechnicalDetails.Substring(0, 500) + "..." : advisory.TechnicalDetails,
            AttackChain = new List<AttackChainStepV1>
            {
                new() { Step = 1, Label = "Attack Vector", Description = advisory.AttackVector },
                new() { Step = 2, Label = "Initial Access", Description = advisory.InitialAccess },
                new() { Step = 3, Label = "Delivery", Description = advisory.DeliveryMechanism },
                new() { Step = 4, Label = "Persistence", Description = advisory.Persistence },
                new() { Step = 5, Label = "Defense Evasion", Description = advisory.DefenseEvasion },
                new() { Step = 6, Label = "C2", Description = advisory.CommandAndControl },
                new() { Step = 7, Label = "Exfiltration", Description = advisory.Exfiltration }
            }.Where(s => !string.IsNullOrEmpty(s.Description)).ToList(),
            
            PermissionsAbuse = new List<string>
            {
                "Malware uses native system tools for execution and persistence.",
                "Keychain access is attempted for credential harvesting."
            },
            
            MitreAttack = new List<MitreAttackV1>
            {
                new() { TechniqueId = "T1566", Tactic = "Initial Access", Description = "Social Engineering" },
                new() { TechniqueId = "T1547", Tactic = "Persistence", Description = "Boot or Logon Autostart Execution" }
            }
        };

        model.Iocs = new IocsV1
        {
            Entries = advisory.IOCs.Select(ioc => new IocEntryV1 
            { 
                Type = InferIocType(ioc), 
                Indicator = ioc, 
                Description = "Observed indicator",
                Defanged = true 
            }).ToList()
        };

        model.DetectionMethods = new DetectionMethodsV1
        {
            Entries = new List<DetectionEntryV1>
            {
                new() 
                { 
                    SubHeading = "Endpoint Hunting", 
                    Body = "Search for suspicious persistence artifacts.",
                    Commands = new List<string> { "ls -la ~/Library/LaunchAgents/", "find / -name \"*Antivirus*\"" },
                    CommandLanguage = "bash"
                }
            }
        };

        model.Assessment = new AssessmentV1
        {
            Intro = "Evaluate exposure using the following checklist.",
            Questions = GetDefaultAssessmentQuestions(),
            RiskRating = new RiskRatingV1 { Selected = advisory.Severity switch { 3 => "Critical", 2 => "High", 1 => "Medium", _ => "Low" } }
        };

        model.Remediation = new RemediationV1
        {
            Entries = advisory.Recommendations.Select(r => new RemediationEntryV1 { Label = "Action", Description = r }).ToList()
        };

        model.References = new ReferencesV1
        {
            Entries = advisory.References.Select((r, i) => new ReferenceEntryV1 { Id = i + 1, Title = "External Source", Url = r }).ToList()
        };

        return model;
    }

    private static string InferIocType(string indicator)
    {
        if (indicator.Contains(".")) return "Domain/IP";
        if (indicator.Length >= 32) return "File Hash";
        return "Network";
    }

    private static List<AssessmentQuestionV1> GetDefaultAssessmentQuestions()
    {
        return new List<AssessmentQuestionV1>
        {
            new() { Id = 1, Category = "Exposure", Question = "Are these assets present in your environment?" },
            new() { Id = 2, Category = "Detection", Question = "Do we have visibility into these indicators?" }
        };
    }
}
