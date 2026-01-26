using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;

namespace TempSeeder;

class Program
{
    static void Main(string[] args)
    {
        // Target Path: ../OrangeIntel.Api/Templates/Reports/
        var basePath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../OrangeIntel.Api/Templates/Reports"));
        Directory.CreateDirectory(basePath);
        
        Console.WriteLine($"Generating templates in: {basePath}");

        CreateAdvisoryTemplate(Path.Combine(basePath, "ThreatAdvisoryTemplate.docx"));
        CreateAssessmentTemplate(Path.Combine(basePath, "ThreatAssessmentTemplate.docx"));
        
        Console.WriteLine("Templates generated successfully.");
    }

    private static void CreateAdvisoryTemplate(string path)
    {
        Console.WriteLine($"Creating {Path.GetFileName(path)}...");
        using var wordDocument = WordprocessingDocument.Create(path, WordprocessingDocumentType.Document);
        var mainPart = wordDocument.AddMainDocumentPart();
        mainPart.Document = new Document();
        var body = mainPart.Document.AppendChild(new Body());

        AddParagraph(body, "OrangeIntel Threat Advisory", "32", true, "E05206", JustificationValues.Center);
        AddParagraph(body, "Title: {{ReportTitle}}", "48", true, "000000", JustificationValues.Center);
        AddParagraph(body, "ID: {{ReportIdentifier}} | Date: {{Date}}", "24", false, "666666", JustificationValues.Center);
        AddParagraph(body, "TLP: {{Classification}}", "24", true, "E05206", JustificationValues.Center);
        body.AppendChild(new Paragraph(new Run(new Break() { Type = BreakValues.Page })));

        AddHeading(body, "Executive Summary");
        AddParagraph(body, "{{ExecutiveSummary}}");
        AddKeyValue(body, "Confidence", "{{ConfidenceStatement}}");

        AddHeading(body, "Affected Assets");
        AddParagraph(body, "{{#AffectedAssets}}"); 
        
        AddHeading(body, "Threat Analysis");
        AddKeyValue(body, "Attack Vector", "{{AttackVector}}");
        AddKeyValue(body, "Initial Access", "{{InitialAccess}}");
        AddKeyValue(body, "Persistence", "{{Persistence}}");
        AddParagraph(body, "{{Payload}}");

        AddHeading(body, "Indicators of Compromise");
        AddParagraph(body, "{{#IOCs}}");

        AddHeading(body, "Recommendations");
        AddParagraph(body, "{{#Recommendations}}");

        AddHeading(body, "References");
        AddParagraph(body, "{{#References}}");

        mainPart.Document.Save();
    }

    private static void CreateAssessmentTemplate(string path)
    {
        Console.WriteLine($"Creating {Path.GetFileName(path)}...");
        using var wordDocument = WordprocessingDocument.Create(path, WordprocessingDocumentType.Document);
        var mainPart = wordDocument.AddMainDocumentPart();
        mainPart.Document = new Document();
        var body = mainPart.Document.AppendChild(new Body());

        AddParagraph(body, "Strategic Threat Assessment", "32", true, "00529B", JustificationValues.Center);
        AddParagraph(body, "{{ReportTitle}}", "48", true, "000000", JustificationValues.Center);
        AddParagraph(body, "ID: {{ReportIdentifier}} | Date: {{Date}}", "24", false, "666666", JustificationValues.Center);
        
        AddHeading(body, "Executive Summary");
        AddParagraph(body, "{{ExecutiveSummary}}");
        AddKeyValue(body, "Risk Statement", "{{RiskStatement}}");

        AddHeading(body, "Impact Assessment");
        AddParagraph(body, "{{#Impacts}}");

        AddHeading(body, "Strategic Recommendations");
        AddParagraph(body, "{{#Recommendations}}");

        mainPart.Document.Save();
    }

    private static void AddHeading(Body body, string text)
    {
        var para = new Paragraph();
        var run = new Run();
        run.RunProperties = new RunProperties(new Bold(), new FontSize() { Val = "32" }, new Color() { Val = "2E2E2E" });
        run.AppendChild(new Text(text));
        para.AppendChild(run);
        para.AppendChild(new ParagraphProperties(new SpacingBetweenLines() { Before = "240", After = "120" }));
        body.AppendChild(para);
    }

    private static void AddParagraph(Body body, string text, string fontSize = "22", bool bold = false, string color = "000000", JustificationValues? align = null)
    {
        var para = new Paragraph();
        if (align != null) para.AppendChild(new ParagraphProperties(new Justification() { Val = align }));
        
        var run = new Run();
        run.RunProperties = new RunProperties(new FontSize() { Val = fontSize }, new Color() { Val = color });
        if (bold) run.RunProperties.AppendChild(new Bold());
        
        run.AppendChild(new Text(text));
        para.AppendChild(run);
        body.AppendChild(para);
    }

    private static void AddKeyValue(Body body, string key, string value)
    {
        var para = new Paragraph();
        var runKey = new Run(new Text($"{key}: "));
        runKey.RunProperties = new RunProperties(new Bold(), new Color() { Val = "555555" });
        var runVal = new Run(new Text(value));
        para.AppendChild(runKey);
        para.AppendChild(runVal);
        body.AppendChild(para);
    }
}
