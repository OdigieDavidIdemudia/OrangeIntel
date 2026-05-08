using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using A = DocumentFormat.OpenXml.Drawing;
using DW = DocumentFormat.OpenXml.Drawing.Wordprocessing;
using PIC = DocumentFormat.OpenXml.Drawing.Pictures;
using OrangeIntel.Application.DTOs.Reporting;
using OrangeIntel.Application.Interfaces;
using System.Text.RegularExpressions;
using System.IO;

namespace OrangeIntel.Infrastructure.Reporting;

public class AdvisoryDocxService : IAdvisoryDocxService
{
    private const string GTCO_ORANGE = "E05C1A";
    private const string LIGHT_ORANGE = "FFF4EE";
    private const string BORDER_GRAY = "CCCCCC";
    private const string HEADER_GRAY = "444444";

    public byte[] GenerateAdvisory(GTBankAdvisoryReportV1 model)
    {
        using var stream = new MemoryStream();
        using (var wordDocument = WordprocessingDocument.Create(stream, WordprocessingDocumentType.Document))
        {
            var mainPart = wordDocument.AddMainDocumentPart();
            mainPart.Document = new Document();
            var body = mainPart.Document.AppendChild(new Body());

            SetupDocument(mainPart);

            BuildCoverPage(mainPart, body, model.Metadata);
            BuildTableOfContents(body);
            BuildReportOverview(body, model.Metadata);
            
            BuildExecutiveSummary(body, model.ExecutiveSummary);
            BuildThreatAnalysis(body, model.ThreatAnalysis);
            BuildIocTable(body, model.Iocs);
            BuildDetectionMethods(body, model.DetectionMethods);
            BuildAssessmentChecklist(body, model.Assessment);
            BuildRemediationPlan(body, model.Remediation);
            BuildReferences(mainPart, body, model.References);

            wordDocument.Save();
        }

        return stream.ToArray();
    }

    private void SetupDocument(MainDocumentPart mainPart)
    {
        var styleDefinitionsPart = mainPart.AddNewPart<StyleDefinitionsPart>();
        var styles = new Styles();
        styles.Save(styleDefinitionsPart);

        // Define Normal Style
        AddStyle(styleDefinitionsPart, "Normal", "Normal", "Arial", "20"); // 10pt = 20 half-points

        // Heading 1
        AddStyle(styleDefinitionsPart, "Heading1", "Heading 1", "Arial", "24", isBold: true);

        // Heading 2
        AddStyle(styleDefinitionsPart, "Heading2", "Heading 2", "Arial", "20", isBold: true);

        // Page Setup
        var sectionProps = new SectionProperties();
        var pageSize = new PageSize { Width = 12240U, Height = 15840U }; // US Letter
        var pageMargin = new PageMargin { Top = 1440, Bottom = 1440, Left = 1440, Right = 1440 }; // 1 inch
        sectionProps.Append(pageSize, pageMargin);
        mainPart.Document.Body.Append(sectionProps);

        // Numbering Definitions
        var numberingPart = mainPart.AddNewPart<NumberingDefinitionsPart>();
        numberingPart.Numbering = new Numbering(
            new AbstractNum(
                new Level(
                    new NumberingFormat { Val = NumberFormatValues.Bullet },
                    new LevelText { Val = "•" }
                ) { LevelIndex = 0 }
            ) { AbstractNumberId = 0 },
            new AbstractNum(
                new Level(
                    new NumberingFormat { Val = NumberFormatValues.Decimal },
                    new LevelText { Val = "%1." }
                ) { LevelIndex = 0 }
            ) { AbstractNumberId = 1 },
            new NumberingInstance(new AbstractNumId { Val = 0 }) { NumberID = 1 },
            new NumberingInstance(new AbstractNumId { Val = 1 }) { NumberID = 2 }
        );
    }

    private void AddStyle(StyleDefinitionsPart styleDefinitionsPart, string styleId, string styleName, string fontName, string fontSize, bool isBold = false)
    {
        var styles = styleDefinitionsPart.Styles;
        var style = new Style { Type = StyleValues.Paragraph, StyleId = styleId, CustomStyle = true };
        style.Append(new StyleName { Val = styleName });
        
        var rPr = new StyleRunProperties();
        rPr.Append(new RunFonts { Ascii = fontName, HighAnsi = fontName });
        rPr.Append(new FontSize { Val = fontSize });
        if (isBold) rPr.Append(new Bold());
        
        style.Append(rPr);
        styles.Append(style);
    }

    private void BuildCoverPage(MainDocumentPart mainPart, Body body, MetadataV1 metadata)
    {
        // Logo
        string logoPath = "";
        var currentDir = Directory.GetCurrentDirectory();
        
        // Try multiple paths depending on how the app is launched
        string[] candidates = {
            Path.Combine(currentDir, "backend", "OrangeIntel.Infrastructure", "Reporting", "Resources", "gtco_logo.png"),
            Path.Combine(currentDir, "OrangeIntel.Infrastructure", "Reporting", "Resources", "gtco_logo.png"),
            Path.Combine(currentDir, "..", "OrangeIntel.Infrastructure", "Reporting", "Resources", "gtco_logo.png"),
            "Resources/gtco_logo.png"
        };

        foreach (var candidate in candidates)
        {
            if (File.Exists(candidate))
            {
                logoPath = candidate;
                break;
            }
        }
        
        var pLogo = new Paragraph();
        var pPr = new ParagraphProperties(new Justification { Val = JustificationValues.Right });
        pLogo.Append(pPr);
        
        var run = new Run();
        if (!string.IsNullOrEmpty(logoPath))
        {
            InsertImage(mainPart, run, logoPath);
        }
        else
        {
            // Fallback to text if image missing
            run.Append(CreateRun("GTCO", GTCO_ORANGE, true, "24"));
        }
        pLogo.Append(run);
        body.Append(pLogo);

        // Horizontal Rule
        body.Append(CreateRuleParagraph());

        body.Append(CreateEmptyParagraph(4));

        // Centered Block
        body.Append(CreateParagraph("Guaranty Trust Bank", JustificationValues.Center, true, "48")); // 24pt
        body.Append(CreateParagraph("Threat Advisory", JustificationValues.Center, true, "36")); // 18pt
        
        body.Append(CreateEmptyParagraph(2));
        
        body.Append(CreateParagraph(metadata.Title, JustificationValues.Center, true, "24", GTCO_ORANGE));

        body.Append(CreateEmptyParagraph(6));
        
        body.Append(new Paragraph(new Run(new Break { Type = BreakValues.Page })));
    }

    private void BuildTableOfContents(Body body)
    {
        body.Append(CreateParagraph("Table of Contents", JustificationValues.Left, true, "24"));
        body.Append(CreateRuleParagraph());

        var sections = new[] {
            "1. Executive Summary", "2. Threat Analysis", "3. IOCs", 
            "4. Detection Methods", "5. Assessment", "6. Remediation & Action Plan", "7. References"
        };

        foreach (var section in sections)
        {
            var p = new Paragraph();
            var pPr = new ParagraphProperties(
                new Tabs(new TabStop { Val = TabStopValues.Right, Position = 9360 })
            );
            p.Append(pPr);
            
            p.Append(CreateRun(section, "000000", false, "20"));
            p.Append(new Run(new TabChar()));
            p.Append(CreateRun("-", "000000", false, "20")); // Page number placeholder
            
            body.Append(p);
        }

        body.Append(new Paragraph(new Run(new Break { Type = BreakValues.Page })));
    }

    private void BuildReportOverview(Body body, MetadataV1 metadata)
    {
        body.Append(CreateLabelValueParagraph("Report Title:", metadata.Title));
        body.Append(CreateLabelValueParagraph("Date:", metadata.Date));
        body.Append(CreateLabelValueParagraph("Prepared By:", metadata.PreparedBy));
        body.Append(CreateLabelValueParagraph("Reviewed By:", metadata.ReviewedBy));
        body.Append(CreateLabelValueParagraph("Organization/Unit:", metadata.OrganizationUnit));
        
        body.Append(CreateRuleParagraph());
        body.Append(CreateEmptyParagraph(1));
    }

    private void BuildExecutiveSummary(Body body, ExecutiveSummaryV1 summary)
    {
        body.Append(CreateHeadingParagraph("1. Executive Summary", "Heading1"));
        body.Append(CreateParagraph(summary.Body));
        body.Append(CreateRuleParagraph());
    }

    private void BuildThreatAnalysis(Body body, ThreatAnalysisV1 analysis)
    {
        body.Append(CreateHeadingParagraph("2. Threat Analysis", "Heading1"));
        body.Append(CreateParagraph(analysis.Intro));

        body.Append(CreateHeadingParagraph("Attack Chain:", "Heading2"));
        foreach (var step in analysis.AttackChain)
        {
            body.Append(CreateNumberedItem($"{step.Label}: {step.Description}", 2));
        }

        if (analysis.PermissionsAbuse.Any())
        {
            body.Append(CreateHeadingParagraph("Permissions & System Abuse:", "Heading2"));
            foreach (var abuse in analysis.PermissionsAbuse)
            {
                body.Append(CreateBulletItem(abuse, 1));
            }
        }

        body.Append(CreateHeadingParagraph("MITRE ATT&CK Mapping:", "Heading2"));
        foreach (var tech in analysis.MitreAttack)
        {
            var p = CreateBulletItem("", 1);
            p.Append(CreateRun($"{tech.TechniqueId} ({tech.Tactic}): ", "000000", true, "20"));
            p.Append(CreateRun(tech.Description, "000000", false, "20"));
            body.Append(p);
        }

        body.Append(CreateRuleParagraph());
    }

    private void BuildIocTable(Body body, IocsV1 iocs)
    {
        body.Append(CreateHeadingParagraph("3. IOCs", "Heading1"));
        
        var table = new Table();

        var tblProps = new TableProperties(
            new TableWidth { Width = "9360", Type = TableWidthUnitValues.Dxa },
            new TableBorders(
                new TopBorder { Val = BorderValues.Single, Size = 4, Color = BORDER_GRAY },
                new BottomBorder { Val = BorderValues.Single, Size = 4, Color = BORDER_GRAY },
                new LeftBorder { Val = BorderValues.Single, Size = 4, Color = BORDER_GRAY },
                new RightBorder { Val = BorderValues.Single, Size = 4, Color = BORDER_GRAY },
                new InsideHorizontalBorder { Val = BorderValues.Single, Size = 4, Color = BORDER_GRAY },
                new InsideVerticalBorder { Val = BorderValues.Single, Size = 4, Color = BORDER_GRAY }
            )
        );
        table.AppendChild(tblProps);

        // Header Row
        var trHeader = new TableRow();
        trHeader.Append(CreateTableCell("Type", GTCO_ORANGE, "FFFFFF", 1560, true));
        trHeader.Append(CreateTableCell("Indicator", GTCO_ORANGE, "FFFFFF", 2800, true));
        trHeader.Append(CreateTableCell("Description", GTCO_ORANGE, "FFFFFF", 5000, true));
        table.Append(trHeader);

        // Data Rows
        bool alternating = false;
        foreach (var ioc in iocs.Entries)
        {
            var tr = new TableRow();
            var bgColor = alternating ? LIGHT_ORANGE : "FFFFFF";
            var indicatorText = ioc.Defanged ? ioc.Indicator : ioc.Indicator; // Mapping might defang on ingress
            tr.Append(CreateTableCell(ioc.Type, bgColor, "000000", 1560));
            tr.Append(CreateTableCell(indicatorText, bgColor, "000000", 2800));
            tr.Append(CreateTableCell(ioc.Description, bgColor, "000000", 5000));
            table.Append(tr);
            alternating = !alternating;
        }

        body.Append(table);
        body.Append(CreateEmptyParagraph(1));
    }

    private void BuildDetectionMethods(Body body, DetectionMethodsV1 methods)
    {
        body.Append(CreateHeadingParagraph("4. Detection Methods", "Heading1"));
        foreach (var dm in methods.Entries)
        {
            body.Append(CreateHeadingParagraph(dm.SubHeading, "Heading2"));
            body.Append(CreateParagraph(dm.Body));
            
            foreach (var cmd in dm.Commands)
            {
                body.Append(CreateCodeParagraph(cmd));
            }
        }
    }

    private void BuildAssessmentChecklist(Body body, AssessmentV1 assessment)
    {
        body.Append(CreateHeadingParagraph("5. Assessment", "Heading1"));
        body.Append(CreateParagraph(assessment.Intro));

        var table = new Table();
        var tblProps = new TableProperties(
                new TableWidth { Width = "9360", Type = TableWidthUnitValues.Dxa },
                new TableBorders(
                    new TopBorder { Val = BorderValues.Single, Size = 4, Color = BORDER_GRAY },
                    new BottomBorder { Val = BorderValues.Single, Size = 4, Color = BORDER_GRAY },
                    new LeftBorder { Val = BorderValues.Single, Size = 4, Color = BORDER_GRAY },
                    new RightBorder { Val = BorderValues.Single, Size = 4, Color = BORDER_GRAY },
                    new InsideHorizontalBorder { Val = BorderValues.Single, Size = 4, Color = BORDER_GRAY },
                    new InsideVerticalBorder { Val = BorderValues.Single, Size = 4, Color = BORDER_GRAY }
                )
            );
        table.AppendChild(tblProps);

        // Header
        var trHeader = new TableRow();
        trHeader.Append(CreateTableCell("#", HEADER_GRAY, "FFFFFF", 540, true));
        trHeader.Append(CreateTableCell("Question", HEADER_GRAY, "FFFFFF", 5820, true));
        trHeader.Append(CreateTableCell("Finding/Observation", HEADER_GRAY, "FFFFFF", 3000, true));
        table.Append(trHeader);

        for (int i = 0; i < assessment.Questions.Count; i++)
        {
            var q = assessment.Questions[i];
            var tr = new TableRow();
            var bgColor = i % 2 == 0 ? "FFFFFF" : "F9F9F9";
            tr.Append(CreateTableCell(q.Id.ToString(), bgColor, "000000", 540));
            tr.Append(CreateTableCell($"[{q.Category}] {q.Question}", bgColor, "000000", 5820));
            tr.Append(CreateTableCell("", bgColor, "000000", 3000));
            table.Append(tr);
        }

        // Risk Rating & Notes
        var trRisk = new TableRow();
        trRisk.Append(CreateTableCell("Overall Risk Rating", "EEEEEE", "000000", 6360, true, 2));
        trRisk.Append(CreateTableCell(assessment.RiskRating.Selected ?? "", "FFFFFF", "000000", 3000));
        table.Append(trRisk);

        var trNotes = new TableRow();
        trNotes.Append(CreateTableCell("Assessment Notes", "EEEEEE", "000000", 6360, true, 2));
        trNotes.Append(CreateTableCell(assessment.AssessmentNotes, "FFFFFF", "000000", 3000));
        table.Append(trNotes);

        body.Append(table);
        body.Append(CreateEmptyParagraph(1));
    }

    private void BuildRemediationPlan(Body body, RemediationV1 remediation)
    {
        body.Append(CreateHeadingParagraph("6. Remediation & Action Plan", "Heading1"));
        foreach (var entry in remediation.Entries)
        {
            var p = CreateBulletItem("", 1);
            p.Append(CreateRun($"{entry.Label}: ", "000000", true, "20"));
            p.Append(CreateRun(entry.Description, "000000", false, "20"));
            body.Append(p);
        }
        body.Append(CreateRuleParagraph());
    }

    private void BuildReferences(MainDocumentPart mainPart, Body body, ReferencesV1 references)
    {
        body.Append(CreateHeadingParagraph("7. References", "Heading1"));
        
        foreach (var reference in references.Entries)
        {
            var p = CreateNumberedItem(reference.Title + " - ", 2);
            
            Uri uri;
            try 
            {
                uri = new Uri(reference.Url);
            }
            catch
            {
                // Fallback for invalid URLs
                uri = new Uri("http://invalid-url");
            }

            var rel = mainPart.AddHyperlinkRelationship(uri, true);
            var hyperlinkId = rel.Id;

            var hyperlink = new Hyperlink(
                new Run(
                    new RunProperties(
                        new RunStyle { Val = "Hyperlink" },
                        new Color { Val = "1155CC" },
                        new Underline { Val = UnderlineValues.Single }
                    ),
                    new Text(reference.Url)
                )
            ) { Id = hyperlinkId };

            p.Append(hyperlink);
            body.Append(p);
        }
    }

    // --- Helpers ---

    private Paragraph CreateParagraph(string text, JustificationValues? align = null, bool bold = false, string size = "20", string color = "000000")
    {
        var p = new Paragraph();
        var pPr = new ParagraphProperties(new Justification { Val = align ?? JustificationValues.Left });
        p.Append(pPr);
        p.Append(CreateRun(text, color, bold, size));
        return p;
    }

    private Paragraph CreateHeadingParagraph(string text, string styleId)
    {
        var p = new Paragraph();
        p.Append(new ParagraphProperties(new ParagraphStyleId { Val = styleId }));
        p.Append(new Run(new Text(text)));
        return p;
    }

    private Run CreateRun(string text, string color, bool bold, string size)
    {
        var run = new Run();
        var rPr = new RunProperties();
        rPr.Append(new RunFonts { Ascii = "Arial", HighAnsi = "Arial" });
        if (bold) rPr.Append(new Bold());
        rPr.Append(new FontSize { Val = size });
        rPr.Append(new Color { Val = color });
        run.Append(rPr);
        run.Append(new Text(text));
        return run;
    }

    private Paragraph CreateEmptyParagraph(int count)
    {
        var p = new Paragraph();
        for (int i = 1; i < count; i++) p.Append(new Run(new Break()));
        return p;
    }

    private Paragraph CreateRuleParagraph()
    {
        var p = new Paragraph();
        var pPr = new ParagraphProperties();
        var pBorders = new ParagraphBorders(new BottomBorder { Val = BorderValues.Single, Size = 6, Color = GTCO_ORANGE });
        pPr.Append(pBorders);
        p.Append(pPr);
        return p;
    }

    private Paragraph CreateLabelValueParagraph(string label, string value)
    {
        var p = new Paragraph();
        p.Append(CreateRun(label + " ", "000000", true, "20"));
        p.Append(CreateRun(value, "000000", false, "20"));
        return p;
    }

    private Paragraph CreateNumberedItem(string text, int numberId)
    {
        var p = new Paragraph();
        var pPr = new ParagraphProperties(
            new NumberingProperties(
                new NumberingLevelReference { Val = 0 },
                new NumberingId { Val = numberId }
            )
        );
        p.Append(pPr);
        p.Append(new Run(new Text(text)));
        return p;
    }

    private Paragraph CreateBulletItem(string text, int numberId)
    {
        var p = new Paragraph();
        var pPr = new ParagraphProperties(
            new NumberingProperties(
                new NumberingLevelReference { Val = 0 },
                new NumberingId { Val = numberId }
            )
        );
        p.Append(pPr);
        if (!string.IsNullOrEmpty(text)) p.Append(new Run(new Text(text)));
        return p;
    }

    private Paragraph CreateCodeParagraph(string code)
    {
        var p = new Paragraph();
        var pPr = new ParagraphProperties();
        pPr.Append(new Shading { Val = ShadingPatternValues.Clear, Color = "auto", Fill = "F4F4F4" });
        p.Append(pPr);
        
        var run = new Run();
        var rPr = new RunProperties();
        rPr.Append(new RunFonts { Ascii = "Courier New", HighAnsi = "Courier New" });
        rPr.Append(new FontSize { Val = "18" });
        run.Append(rPr);
        run.Append(new Text(code));
        p.Append(run);
        return p;
    }

    private TableCell CreateTableCell(string text, string bgColor, string textColor, int width, bool bold = false, int colSpan = 1)
    {
        var tc = new TableCell();
        var tcPr = new TableCellProperties();
        tcPr.Append(new TableCellWidth { Width = width.ToString(), Type = TableWidthUnitValues.Dxa });
        tcPr.Append(new Shading { Val = ShadingPatternValues.Clear, Color = "auto", Fill = bgColor });
        
        if (colSpan > 1)
        {
            tcPr.Append(new GridSpan { Val = colSpan });
        }

        tcPr.Append(new TableCellMargin(
            new TopMargin { Width = "80", Type = TableWidthUnitValues.Dxa },
            new BottomMargin { Width = "80", Type = TableWidthUnitValues.Dxa },
            new LeftMargin { Width = "120", Type = TableWidthUnitValues.Dxa },
            new RightMargin { Width = "120", Type = TableWidthUnitValues.Dxa }
        ));

        tc.Append(tcPr);
        tc.Append(CreateParagraph(text, JustificationValues.Left, bold, "18", textColor));
        return tc;
    }

    private void InsertImage(MainDocumentPart mainPart, Run run, string imagePath)
    {
        ImagePart imagePart = mainPart.AddImagePart(ImagePartType.Png);
        using (FileStream stream = new FileStream(imagePath, FileMode.Open))
        {
            imagePart.FeedData(stream);
        }

        AddImageToRun(mainPart.GetIdOfPart(imagePart), run);
    }

    private void AddImageToRun(string relationshipId, Run run)
    {
        // Define the reference of the image.
        var element =
             new Drawing(
                 new DW.Inline(
                     new DW.Extent() { Cx = 1828800L, Cy = 731520L }, // Size in EMUs (1 inch = 914400 EMUs). 2.0" x 0.8"
                     new DW.EffectExtent()
                     {
                         LeftEdge = 0L,
                         TopEdge = 0L,
                         RightEdge = 0L,
                         BottomEdge = 0L
                     },
                     new DW.DocProperties()
                     {
                         Id = (UInt32Value)1U,
                         Name = "GTCO Logo"
                     },
                     new DW.NonVisualGraphicFrameDrawingProperties(
                         new A.GraphicFrameLocks() { NoChangeAspect = true }),
                     new A.Graphic(
                         new A.GraphicData(
                             new PIC.Picture(
                                 new PIC.NonVisualPictureProperties(
                                     new PIC.NonVisualDrawingProperties()
                                     {
                                         Id = (UInt32Value)0U,
                                         Name = "gtco_logo.png"
                                     },
                                     new PIC.NonVisualPictureDrawingProperties()),
                                 new PIC.BlipFill(
                                     new A.Blip()
                                     {
                                         Embed = relationshipId,
                                         CompressionState =
                                             A.BlipCompressionValues.Print
                                     },
                                     new A.Stretch(
                                         new A.FillRectangle())),
                                 new PIC.ShapeProperties(
                                     new A.Transform2D(
                                         new A.Offset() { X = 0L, Y = 0L },
                                         new A.Extents() { Cx = 1828800L, Cy = 731520L }),
                                     new A.PresetGeometry(
                                         new A.AdjustValueList()
                                     ) { Preset = A.ShapeTypeValues.Rectangle }))
                         ) { Uri = "http://schemas.openxmlformats.org/drawingml/2006/picture" })
                 )
                 {
                     DistanceFromTop = (UInt32Value)0U,
                     DistanceFromBottom = (UInt32Value)0U,
                     DistanceFromLeft = (UInt32Value)0U,
                     DistanceFromRight = (UInt32Value)0U,
                     EditId = "50D07946"
                 });

        run.Append(element);
    }
}
