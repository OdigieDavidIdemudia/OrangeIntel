using Xunit;
using OrangeIntel.Infrastructure.Reporting;
using OrangeIntel.Domain.Entities;
using System.Text.Json;
using System;

namespace OrangeIntel.Tests;

public class ReportGeneratorTests
{
    private readonly Report _dummyReport;
    private readonly string _dummyContent;

    public ReportGeneratorTests()
    {
        _dummyReport = new Report
        {
            Title = "Test Report",
            Classification = "TLP:AMBER",
            GeneratedAt = DateTime.UtcNow
        };

        _dummyReport.ReportType = "ThreatAssessment";

        var content = new OrangeIntel.Application.DTOs.Reporting.ThreatAssessmentReport();
        content.ThreatIntelligenceAssessment.Metadata.ReportTitle = "Test Report";
        content.ThreatIntelligenceAssessment.ExecutiveSummary.AdvisorySummary = "This is a summary.";
        
        _dummyContent = JsonSerializer.Serialize(content);
    }



    [Fact]
    public void DocxGenerator_ShouldGenerateBytes()
    {
        var mockEnv = new Mocks.MockWebHostEnvironment();
        // Ensure templates directory exists for test
        var templatesPath = Path.Combine(mockEnv.ContentRootPath, "Templates", "Reports");
        Directory.CreateDirectory(templatesPath);
        File.WriteAllText(Path.Combine(templatesPath, "ThreatAssessmentTemplate.docx"), "dummy content");

        var generator = new DocxReportGenerator(mockEnv);
        var result = generator.Generate(_dummyReport, _dummyContent);
        Assert.NotNull(result);
        Assert.NotEmpty(result);
    }
}
