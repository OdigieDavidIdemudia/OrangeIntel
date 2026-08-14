using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TealHunt.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateThreatItemRelevance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "AffectedSector",
                table: "threat_items",
                newName: "EnvironmentRelevance");

            migrationBuilder.AddColumn<DateTime>(
                name: "AcceptedAt",
                table: "threat_items",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AssignedTeam",
                table: "threat_items",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AcceptedAt",
                table: "threat_items");

            migrationBuilder.DropColumn(
                name: "AssignedTeam",
                table: "threat_items");

            migrationBuilder.RenameColumn(
                name: "EnvironmentRelevance",
                table: "threat_items",
                newName: "AffectedSector");
        }
    }
}
