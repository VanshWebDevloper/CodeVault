require("dotenv").config();

const express = require("express");
const path = require("path");

const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "..", "public")));

/*
 API
*/

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "CodeVault backend is running 🚀"
    });
});

// GET all projects
app.get("/api/projects", (req, res) => {
    const sql = `
        SELECT *
        FROM projects
        ORDER BY created_at DESC
    `;

    db.all(sql, [], (error, projects) => {
        if (error) {
            console.error(error);

            return res.status(500).json({
                success: false,
                error: "Failed to fetch projects"
            });
        }

        res.json({
            success: true,
            projects
        });
    });
});

// GET one project
app.get("/api/projects/:id", (req, res) => {
    const { id } = req.params;

    db.get(
        "SELECT * FROM projects WHERE id = ?",
        [id],
        (error, project) => {
            if (error) {
                return res.status(500).json({
                    success: false,
                    error: "Failed to fetch project"
                });
            }

            if (!project) {
                return res.status(404).json({
                    success: false,
                    error: "Project not found"
                });
            }

            res.json({
                success: true,
                project
            });
        }
    );
});

// CREATE project
app.post("/api/projects", (req, res) => {
    const { name, description = "" } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({
            success: false,
            error: "Project name is required"
        });
    }

    const sql = `
        INSERT INTO projects (name, description)
        VALUES (?, ?)
    `;

    db.run(
        sql,
        [name.trim(), description],
        function (error) {
            if (error) {
                console.error(error);

                return res.status(500).json({
                    success: false,
                    error: "Failed to create project"
                });
            }

            db.get(
                "SELECT * FROM projects WHERE id = ?",
                [this.lastID],
                (error, project) => {
                    if (error) {
                        return res.status(500).json({
                            success: false,
                            error: "Project created but could not be retrieved"
                        });
                    }

                    res.status(201).json({
                        success: true,
                        project
                    });
                }
            );
        }
    );
});

// UPDATE project
app.put("/api/projects/:id", (req, res) => {
    const { id } = req.params;
    const { name, description = "" } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({
            success: false,
            error: "Project name is required"
        });
    }

    const sql = `
        UPDATE projects
        SET
            name = ?,
            description = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;

    db.run(
        sql,
        [name.trim(), description, id],
        function (error) {
            if (error) {
                return res.status(500).json({
                    success: false,
                    error: "Failed to update project"
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    success: false,
                    error: "Project not found"
                });
            }

            db.get(
                "SELECT * FROM projects WHERE id = ?",
                [id],
                (error, project) => {
                    if (error) {
                        return res.status(500).json({
                            success: false,
                            error: "Failed to retrieve updated project"
                        });
                    }

                    res.json({
                        success: true,
                        project
                    });
                }
            );
        }
    );
});

// DELETE project
app.delete("/api/projects/:id", (req, res) => {
    const { id } = req.params;

    db.run(
        "DELETE FROM projects WHERE id = ?",
        [id],
        function (error) {
            if (error) {
                return res.status(500).json({
                    success: false,
                    error: "Failed to delete project"
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    success: false,
                    error: "Project not found"
                });
            }

            res.json({
                success: true,
                message: "Project deleted"
            });
        }
    );
});

/*
 Start Server
*/

app.listen(PORT, () => {
    console.log("");
    console.log("╔══════════════════════════════╗");
    console.log("║       CODEVAULT SERVER       ║");
    console.log("╚══════════════════════════════╝");
    console.log(`🚀 http://localhost:${PORT}`);
});