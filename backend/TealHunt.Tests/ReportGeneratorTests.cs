using Xunit;
using TealHunt.Infrastructure.Reporting;
using TealHunt.Domain.Entities;
using System.Text.Json;
using System;

namespace TealHunt.Tests;

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

        _dummyReport.ReportType = "ThreatAdvisory";

        var content = new TealHunt.Application.DTOs.Reporting.ThreatAdvisoryReport();
        content.Report.CoverPage.ReportTitle = "Test Report";
        content.Report.ExecutiveSummary.Content = "This is a summary.";
        
        _dummyContent = JsonSerializer.Serialize(content);
    }



    [Fact]
    public void DocxGenerator_ShouldGenerateBytes()
    {
        var mockEnv = new Mocks.MockWebHostEnvironment();
        // Ensure templates directory exists for test
        var templatesPath = Path.Combine(mockEnv.ContentRootPath, "Templates", "Reports");
        Directory.CreateDirectory(templatesPath);
        File.WriteAllText(Path.Combine(templatesPath, "ThreatAdvisoryTemplate.docx"), "dummy content");

        var generator = new DocxReportGenerator(mockEnv);
        var result = generator.Generate(_dummyReport, _dummyContent);
        Assert.NotNull(result);
        Assert.NotEmpty(result);
    }
}
