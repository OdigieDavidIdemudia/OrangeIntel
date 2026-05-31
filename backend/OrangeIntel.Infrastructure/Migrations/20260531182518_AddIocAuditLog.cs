using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace OrangeIntel.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddIocAuditLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "IocAuditLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    IndicatorValue = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    IndicatorType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    RiskScore = table.Column<int>(type: "integer", nullable: false),
                    RawResultJson = table.Column<string>(type: "jsonb", nullable: false),
                    QueriedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    QueriedByUserId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IocAuditLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_IocAuditLogs_users_QueriedByUserId",
                        column: x => x.QueriedByUserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_IocAuditLogs_QueriedByUserId",
                table: "IocAuditLogs",
                column: "QueriedByUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "IocAuditLogs");
        }
    }
}
