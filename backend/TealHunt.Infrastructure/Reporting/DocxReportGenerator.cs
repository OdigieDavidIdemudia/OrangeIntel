using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using TealHunt.Application.Interfaces;
using TealHunt.Application.DTOs.Reporting;
using TealHunt.Domain.Entities;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting; // For IWebHostEnvironment

namespace TealHunt.Infrastructure.Reporting;

public class DocxReportGenerator : IReportGenerator
{
    private readonly string _templatePath;

    public DocxReportGenerator(IWebHostEnvironment env)
    {
        _templatePath = Path.Combine(env.ContentRootPath, "Templates", "Reports");
    }

    public string SupportedFormat => "DOCX";

    public byte[] Generate(Report report, string contentJson)
    {
        string templateFile = "";
        Dictionary<string, string> textPlaceholders = new();
        Dictionary<string, List<string>> listPlaceholders = new();

        // 1. Prepare Data
        if (report.ReportType.Equals("ThreatAdvisory", StringComparison.OrdinalIgnoreCase))
        {
            templateFile = "ThreatAdvisoryTemplate.docx";
            var model = JsonSerializer.Deserialize<ThreatAdvisoryReport>(contentJson);
            var data = model?.Report ?? new ThreatAdvisoryReport.AdvisoryContent();
            
            // Text Mappings
            textPlaceholders["{{ReportTitle}}"] = data.CoverPage.ReportTitle;
            textPlaceholders["{{ReportIdentifier}}"] = data.CoverPage.ReportIdentifier;
            textPlaceholders["{{Date}}"] = data.ReportOverview.Date;
            textPlaceholders["{{Classification}}"] = data.CoverPage.Classification;
            textPlaceholders["{{ExecutiveSummary}}"] = data.ExecutiveSummary.Content;
            textPlaceholders["{{ConfidenceStatement}}"] = data.ExecutiveSummary.ConfidenceStatement;
            
            textPlaceholders["{{AttackVector}}"] = data.ThreatAnalysis.AttackChain.AttackVector;
            textPlaceholders["{{InitialAccess}}"] = data.ThreatAnalysis.AttackChain.InitialAccess;
            textPlaceholders["{{Persistence}}"] = data.ThreatAnalysis.AttackChain.Persistence;
            textPlaceholders["{{Payload}}"] = data.ThreatAnalysis.AttackChain.Payload;

            // List Mappings (Simplified for MVP: taking strings)
            listPlaceholders["{{#AffectedAssets}}"] = data.AffectedAssets;
            listPlaceholders["{{#IOCs}}"] = data.IndicatorsOfCompromise.DomainsAndUrls.Select(d => $"{d.Indicator} ({d.Description})").ToList();
            listPlaceholders["{{#Recommendations}}"] = data.MitigationAndBlocking.HardeningActions;
            listPlaceholders["{{#References}}"] = data.References.Select(r => $"{r.Title}: {r.Url}").ToList();

        }
        else 
        {
            throw new NotSupportedException($"Report type {report.ReportType} is not supported.");
        }

        var fullPath = Path.Combine(_templatePath, templateFile);
        if (!File.Exists(fullPath)) throw new FileNotFoundException($"Template not found: {templateFile}");

        // 2. Load & Process Template
        byte[] templateBytes = File.ReadAllBytes(fullPath);
        using (var stream = new MemoryStream())
        {
            stream.Write(templateBytes, 0, templateBytes.Length);
            using (var doc = WordprocessingDocument.Open(stream, true))
            {
                var body = doc.MainDocumentPart?.Document.Body;
                if (body != null)
                {
                    // Replace Text
                    foreach (var ph in textPlaceholders)
                    {
                        ReplaceText(body, ph.Key, ph.Value ?? "");
                    }

                    // Process Lists
                    foreach (var listPh in listPlaceholders)
                    {
                        ProcessList(body, listPh.Key, listPh.Value);
                    }
                }
                doc.Save();
            }
            return stream.ToArray();
        }
    }

    private void ReplaceText(Body body, string placeholder, string value)
    {
        // Simple text replacement - finds all text elements containing the placeholder
        var texts = body.Descendants<Text>().Where(t => t.Text.Contains(placeholder)).ToList();
        foreach (var text in texts)
        {
            text.Text = text.Text.Replace(placeholder, value);
        }
    }

    private void ProcessList(Body body, string placeholder, List<string> items)
    {
        // Findings the paragraph containing the placeholder
        var para = body.Descendants<Paragraph>()
                       .FirstOrDefault(p => p.InnerText.Contains(placeholder));

        if (para == null) return;

        // Parent is usually Body or TableCell. We want to insert duplicates after this paragraph.
        var parent = para.Parent;

        if (items == null || items.Count == 0)
        {
            // If no items, remove the placeholder paragraph
            para.Remove();
            return;
        }

        // Use the first item to replace the placeholder in the current paragraph
        ReplaceText(body, placeholder, items[0]); // Hacky recursion reuse or just direct replace
        // Note: ReplaceText searches whole body, which is inefficient but safe. 
        // Better: replace in 'para' specifically.
        var text = para.Descendants<Text>().FirstOrDefault(t => t.Text.Contains(placeholder));
        if (text != null) text.Text = text.Text.Replace(placeholder, "• " + items[0]);

        // For remaining items, clone the paragraph and insert after
        var currentPara = para;
        for (int i = 1; i < items.Count; i++)
        {
            var newPara = para.CloneNode(true) as Paragraph;
            // Set text
             var t = newPara.Descendants<Text>().FirstOrDefault(); // Assuming simple structure
             if (t != null) t.Text = "• " + items[i];
             
             parent.InsertAfter(newPara, currentPara);
             currentPara = newPara;
        }
    }
}
