using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrangeIntel.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTranslationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Language",
                table: "threat_items",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "OriginalSummary",
                table: "threat_items",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "OriginalTitle",
                table: "threat_items",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Language",
                table: "threat_items");

            migrationBuilder.DropColumn(
                name: "OriginalSummary",
                table: "threat_items");

            migrationBuilder.DropColumn(
                name: "OriginalTitle",
                table: "threat_items");
        }
    }
}
