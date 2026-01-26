using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace OrangeIntel.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAdvisoryFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MfaEnabled",
                table: "users");

            migrationBuilder.DropColumn(
                name: "Role",
                table: "users");

            migrationBuilder.AddColumn<string>(
                name: "MfaSecret",
                table: "users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NotificationPreferencesJson",
                table: "users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RefreshToken",
                table: "users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RefreshTokenExpiryTime",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SignalPhoneNumber",
                table: "users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AffectedSector",
                table: "threat_items",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AttackVector",
                table: "threat_items",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DeliveryMechanism",
                table: "threat_items",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Classification",
                table: "reports",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<List<string>>(
                name: "Applications",
                table: "assessments",
                type: "text[]",
                nullable: false);

            migrationBuilder.AddColumn<List<string>>(
                name: "DataTypes",
                table: "assessments",
                type: "text[]",
                nullable: false);

            migrationBuilder.AddColumn<List<string>>(
                name: "ImmediateActions",
                table: "assessments",
                type: "text[]",
                nullable: false);

            migrationBuilder.AddColumn<List<string>>(
                name: "ImpactedServices",
                table: "assessments",
                type: "text[]",
                nullable: false);

            migrationBuilder.AddColumn<List<string>>(
                name: "LongTermActions",
                table: "assessments",
                type: "text[]",
                nullable: false);

            migrationBuilder.AddColumn<List<string>>(
                name: "ShortTermActions",
                table: "assessments",
                type: "text[]",
                nullable: false);

            migrationBuilder.AddColumn<List<string>>(
                name: "Systems",
                table: "assessments",
                type: "text[]",
                nullable: false);

            migrationBuilder.AddColumn<List<string>>(
                name: "AffectedAssets",
                table: "advisories",
                type: "text[]",
                nullable: false);

            migrationBuilder.AddColumn<string>(
                name: "AttackVector",
                table: "advisories",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CommandAndControl",
                table: "advisories",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ConfidenceStatement",
                table: "advisories",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DefenseEvasion",
                table: "advisories",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DeliveryMechanism",
                table: "advisories",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Exfiltration",
                table: "advisories",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<List<string>>(
                name: "IOCs",
                table: "advisories",
                type: "text[]",
                nullable: false);

            migrationBuilder.AddColumn<string>(
                name: "InitialAccess",
                table: "advisories",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Persistence",
                table: "advisories",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<List<string>>(
                name: "Recommendations",
                table: "advisories",
                type: "text[]",
                nullable: false);

            migrationBuilder.AddColumn<List<string>>(
                name: "References",
                table: "advisories",
                type: "text[]",
                nullable: false);

            migrationBuilder.AddColumn<int>(
                name: "Severity",
                table: "advisories",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "audit_logs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<string>(type: "text", nullable: true),
                    Action = table.Column<string>(type: "text", nullable: false),
                    Details = table.Column<string>(type: "text", nullable: true),
                    IpAddress = table.Column<string>(type: "text", nullable: true),
                    Timestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_logs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_audit_logs_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_UserId",
                table: "audit_logs",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "audit_logs");

            migrationBuilder.DropColumn(
                name: "MfaSecret",
                table: "users");

            migrationBuilder.DropColumn(
                name: "NotificationPreferencesJson",
                table: "users");

            migrationBuilder.DropColumn(
                name: "RefreshToken",
                table: "users");

            migrationBuilder.DropColumn(
                name: "RefreshTokenExpiryTime",
                table: "users");

            migrationBuilder.DropColumn(
                name: "SignalPhoneNumber",
                table: "users");

            migrationBuilder.DropColumn(
                name: "AffectedSector",
                table: "threat_items");

            migrationBuilder.DropColumn(
                name: "AttackVector",
                table: "threat_items");

            migrationBuilder.DropColumn(
                name: "DeliveryMechanism",
                table: "threat_items");

            migrationBuilder.DropColumn(
                name: "Classification",
                table: "reports");

            migrationBuilder.DropColumn(
                name: "Applications",
                table: "assessments");

            migrationBuilder.DropColumn(
                name: "DataTypes",
                table: "assessments");

            migrationBuilder.DropColumn(
                name: "ImmediateActions",
                table: "assessments");

            migrationBuilder.DropColumn(
                name: "ImpactedServices",
                table: "assessments");

            migrationBuilder.DropColumn(
                name: "LongTermActions",
                table: "assessments");

            migrationBuilder.DropColumn(
                name: "ShortTermActions",
                table: "assessments");

            migrationBuilder.DropColumn(
                name: "Systems",
                table: "assessments");

            migrationBuilder.DropColumn(
                name: "AffectedAssets",
                table: "advisories");

            migrationBuilder.DropColumn(
                name: "AttackVector",
                table: "advisories");

            migrationBuilder.DropColumn(
                name: "CommandAndControl",
                table: "advisories");

            migrationBuilder.DropColumn(
                name: "ConfidenceStatement",
                table: "advisories");

            migrationBuilder.DropColumn(
                name: "DefenseEvasion",
                table: "advisories");

            migrationBuilder.DropColumn(
                name: "DeliveryMechanism",
                table: "advisories");

            migrationBuilder.DropColumn(
                name: "Exfiltration",
                table: "advisories");

            migrationBuilder.DropColumn(
                name: "IOCs",
                table: "advisories");

            migrationBuilder.DropColumn(
                name: "InitialAccess",
                table: "advisories");

            migrationBuilder.DropColumn(
                name: "Persistence",
                table: "advisories");

            migrationBuilder.DropColumn(
                name: "Recommendations",
                table: "advisories");

            migrationBuilder.DropColumn(
                name: "References",
                table: "advisories");

            migrationBuilder.DropColumn(
                name: "Severity",
                table: "advisories");

            migrationBuilder.AddColumn<bool>(
                name: "MfaEnabled",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Role",
                table: "users",
                type: "text",
                nullable: false,
                defaultValue: "");
        }
    }
}
