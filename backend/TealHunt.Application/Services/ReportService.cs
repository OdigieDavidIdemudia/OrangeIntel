using TealHunt.Application.Interfaces;
using TealHunt.Domain.Entities;
using System.Text.Json;
using TealHunt.Application.DTOs.Reporting;
using Microsoft.Extensions.Logging;

namespace TealHunt.Application.Services;

public class ReportService : IReportService
{
    private readonly IReportRepository _repository;
    private readonly IAdvisoryRepository _advisoryRepository;
    private readonly IReportGenerator _generator; // Single generator
    private readonly IGeminiAiService _geminiService;
    private readonly ILogger<ReportService> _logger;

    public ReportService(
        IReportRepository repository, 
        IAdvisoryRepository advisoryRepository, 
        IReportGenerator generator,
        IGeminiAiService geminiService,
        ILogger<ReportService> logger)
    {
        _repository = repository;
        _advisoryRepository = advisoryRepository;
        _generator = generator;
        _geminiService = geminiService;
        _logger = logger;
    }

    public async Task<IEnumerable<Report>> GetReportsAsync(string userId)
    {
        return await _repository.GetByUserIdAsync(userId);
    }

    public async Task<Report?> GetReportByIdAsync(Guid id)
    {
        return await _repository.GetByIdAsync(id);
    }

    public async Task<Report?> GenerateReportAsync(Guid artifactId, string type, string format, string userId) // format is ignored, always DOCX
    {
        var report = await BuildReportEntity(artifactId, type, userId);
        if (report == null) return null;

        await _repository.AddAsync(report);
        return report;
    }

    public async Task<Report> SaveAdvisoryReportAsync(GTBankAdvisoryReportV1 model, string userId)
    {
        var report = new Report
        {
            ReportType = "ThreatAdvisory",
            Title = model.Metadata.Title,
            Classification = model.Metadata.Tlp.StartsWith("TLP:") ? model.Metadata.Tlp : $"TLP:{model.Metadata.Tlp}",
            ContentJson = JsonSerializer.Serialize(model),
            Format = "DOCX",
            GeneratedAt = DateTime.UtcNow,
            GeneratedById = userId
        };

        await _repository.AddAsync(report);
        return report;
    }

    public async Task<byte[]?> GetReportFileAsync(Guid reportId)
    {
        var report = await _repository.GetByIdAsync(reportId);
        if (report == null) return null;
        
        return _generator.Generate(report, report.ContentJson);
    }

    // New Preview Method
    public async Task<byte[]?> GeneratePreviewAsync(Guid artifactId, string type, string userId)
    {
        var report = await BuildReportEntity(artifactId, type, userId);
        if (report == null) return null;

        // Log Payload for Audit/Debugging (IM-03)
        _logger.LogInformation("Generating Preview for {Type} {ArtifactId}. Payload: {Payload}", type, artifactId, report.ContentJson);

        return _generator.Generate(report, report.ContentJson);
    }

    private async Task<Report?> BuildReportEntity(Guid artifactId, string type, string userId)
    {
         string title = "";
        string classification = "TLP:AMBER";
        string contentJson = "{}";

        // Normalize Type
        if (type.Equals("Advisory", StringComparison.OrdinalIgnoreCase) || type.Equals("ThreatAdvisory", StringComparison.OrdinalIgnoreCase))
        {
            type = "ThreatAdvisory";
        }
        else if (type.Equals("Assessment", StringComparison.OrdinalIgnoreCase) || type.Equals("ThreatAssessment", StringComparison.OrdinalIgnoreCase))
        {
            type = "ThreatAssessment";
        }

        if (type.Equals("ThreatAdvisory", StringComparison.OrdinalIgnoreCase))
        {
            var advisory = await _advisoryRepository.GetByIdAsync(artifactId);
            if (advisory == null) return null;

            title = advisory.Title;
            classification = advisory.Classification;

            var reportModel = new ThreatAdvisoryReport();
            reportModel.Report.CoverPage.ReportTitle = title;
            reportModel.Report.CoverPage.ReportIdentifier = $"ADV-{DateTime.UtcNow:yyyyMMdd}-{advisory.Id.ToString().Substring(0,4)}";
            reportModel.Report.CoverPage.Classification = classification;

            reportModel.Report.ReportOverview.ReportTitle = title;
            reportModel.Report.ReportOverview.Date = DateTime.UtcNow.ToString("yyyy-MM-dd");
            reportModel.Report.ReportOverview.PreparedBy = userId; 

            reportModel.Report.CoverPage.Severity = advisory.Severity switch {
                1 => "Low", 2 => "Medium", 3 => "High", 4 => "Critical", _ => "Low"
            };

            reportModel.Report.ExecutiveSummary.Content = advisory.ExecutiveSummary;
            reportModel.Report.ExecutiveSummary.ConfidenceStatement = advisory.ConfidenceStatement;
            reportModel.Report.AffectedAssets = advisory.AffectedAssets;

            // Map content
            reportModel.Report.ThreatAnalysis.AttackChain.Payload = advisory.TechnicalDetails; 
            reportModel.Report.ThreatAnalysis.AttackChain.DeliveryMechanism = advisory.DeliveryMechanism;
            reportModel.Report.ThreatAnalysis.AttackChain.InitialAccess = advisory.InitialAccess;
            reportModel.Report.ThreatAnalysis.AttackChain.Persistence = advisory.Persistence;
            reportModel.Report.ThreatAnalysis.AttackChain.DefenseEvasion = advisory.DefenseEvasion;
            reportModel.Report.ThreatAnalysis.AttackChain.AttackVector = advisory.AttackVector;
            reportModel.Report.ThreatAnalysis.AttackChain.CommandAndControl = advisory.CommandAndControl;
            reportModel.Report.ThreatAnalysis.AttackChain.Exfiltration = advisory.Exfiltration;
            
            reportModel.Report.MitigationAndBlocking.HardeningActions = advisory.Recommendations;
            if (!string.IsNullOrEmpty(advisory.RecommendedActions) && !advisory.Recommendations.Contains(advisory.RecommendedActions))
            {
                reportModel.Report.MitigationAndBlocking.HardeningActions.Add(advisory.RecommendedActions);
            }

            foreach(var ioc in advisory.IOCs)
            {
                 reportModel.Report.IndicatorsOfCompromise.DomainsAndUrls.Add(new DomainUrlIOC { Indicator = ioc, Description = "IOC" });
            }

            foreach(var refItem in advisory.References)
            {
                 reportModel.Report.References.Add(new ReferenceItem { Title = "Reference", Url = refItem });
            }

            contentJson = JsonSerializer.Serialize(reportModel);
        }
        else
        {
            return null; // Assessment removed
        }

        // Use Gemini AI to correct the format
        var correctedContentJson = await _geminiService.AnalyzeReportFormatAsync(contentJson);

        return new Report
        {
            ReportType = type,
            Title = title,
            Classification = classification,
            ContentJson = correctedContentJson,
            Format = "DOCX", // Enforced
            GeneratedAt = DateTime.UtcNow,
            GeneratedById = userId
        };
    }
}
