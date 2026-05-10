using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrangeIntel.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkflowEnhancements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AcknowledgedAt",
                table: "threat_items",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AcknowledgedBy",
                table: "threat_items",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AcknowledgementNote",
                table: "threat_items",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "threat_items",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AcknowledgedAt",
                table: "threat_items");

            migrationBuilder.DropColumn(
                name: "AcknowledgedBy",
                table: "threat_items");

            migrationBuilder.DropColumn(
                name: "AcknowledgementNote",
                table: "threat_items");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "threat_items");
        }
    }
}
