using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TealHunt.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveAssessmentModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "assessment_drafts");

            migrationBuilder.DropTable(
                name: "assessments");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "assessment_drafts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AdvisoryId = table.Column<Guid>(type: "uuid", nullable: true),
                    AuthorId = table.Column<string>(type: "text", nullable: false),
                    ContentJson = table.Column<string>(type: "jsonb", nullable: false),
                    LastSavedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_assessment_drafts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "assessments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AdvisoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    Applications = table.Column<List<string>>(type: "text[]", nullable: false),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedById = table.Column<string>(type: "text", nullable: true),
                    BusinessImpact = table.Column<string>(type: "text", nullable: false),
                    ConfidenceStatement = table.Column<string>(type: "text", nullable: false),
                    DataTypes = table.Column<List<string>>(type: "text[]", nullable: false),
                    ExecutiveSummary = table.Column<string>(type: "text", nullable: false),
                    ImmediateActions = table.Column<List<string>>(type: "text[]", nullable: false),
                    ImpactedServices = table.Column<List<string>>(type: "text[]", nullable: false),
                    LongTermActions = table.Column<List<string>>(type: "text[]", nullable: false),
                    RiskRating = table.Column<int>(type: "integer", nullable: false),
                    ShortTermActions = table.Column<List<string>>(type: "text[]", nullable: false),
                    Systems = table.Column<List<string>>(type: "text[]", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_assessments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_assessments_advisories_AdvisoryId",
                        column: x => x.AdvisoryId,
                        principalTable: "advisories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_assessments_AdvisoryId",
                table: "assessments",
                column: "AdvisoryId");
        }
    }
}
