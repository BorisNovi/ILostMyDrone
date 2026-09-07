using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LostDroneApi.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Sessions",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CreatorToken = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    TargetLatitude = table.Column<double>(type: "double precision", nullable: false),
                    TargetLongitude = table.Column<double>(type: "double precision", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CheckedCells",
                columns: table => new
                {
                    SessionId = table.Column<string>(type: "character varying(32)", nullable: false),
                    CellX = table.Column<int>(type: "integer", nullable: false),
                    CellY = table.Column<int>(type: "integer", nullable: false),
                    Color = table.Column<string>(type: "character varying(6)", maxLength: 6, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CheckedCells", x => new { x.SessionId, x.CellX, x.CellY });
                    table.ForeignKey(
                        name: "FK_CheckedCells_Sessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "Sessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CheckedCells");

            migrationBuilder.DropTable(
                name: "Sessions");
        }
    }
}
