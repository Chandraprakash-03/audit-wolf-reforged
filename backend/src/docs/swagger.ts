import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import { Express } from "express";

// Load OpenAPI specification from YAML file
const swaggerDocument = YAML.load(path.join(__dirname, "openapi.yaml"));

// Swagger JSDoc options for additional inline documentation
const swaggerOptions: swaggerJSDoc.Options = {
	definition: swaggerDocument,
	apis: [
		path.join(__dirname, "../routes/*.ts"),
		path.join(__dirname, "../models/*.ts"),
	],
};

// Generate swagger specification
const swaggerSpec = swaggerJSDoc(swaggerOptions);

// Swagger UI options
const swaggerUiOptions = {
	explorer: true,
	swaggerOptions: {
		docExpansion: "none",
		filter: true,
		showRequestDuration: true,
		tryItOutEnabled: true,
		requestInterceptor: (req: any) => {
			// Add authorization header if available
			const token = localStorage.getItem("authToken");
			if (token) {
				req.headers.Authorization = `Bearer ${token}`;
			}
			return req;
		},
	},
	customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 20px 0 }
    .swagger-ui .scheme-container { background: #fafafa; padding: 10px; border-radius: 4px; }
  `,
	customSiteTitle: "Audit Wolf API Documentation",
	customfavIcon: "/favicon.ico",
};

/**
 * Setup Swagger documentation for Express app
 */
export function setupSwagger(app: Express): void {
	// Serve swagger documentation at /api-docs
	app.use("/api-docs", swaggerUi.serve);
	app.get("/api-docs", swaggerUi.setup(swaggerSpec, swaggerUiOptions));

	// Serve raw OpenAPI spec as JSON
	app.get("/api-docs.json", (req, res) => {
		res.setHeader("Content-Type", "application/json");
		res.send(swaggerSpec);
	});

	// Serve raw OpenAPI spec as YAML
	app.get("/api-docs.yaml", (req, res) => {
		res.setHeader("Content-Type", "text/yaml");
		res.send(YAML.stringify(swaggerSpec, 4));
	});

	console.log("📚 API Documentation available at /api-docs");
	console.log("📄 OpenAPI JSON spec available at /api-docs.json");
	console.log("📄 OpenAPI YAML spec available at /api-docs.yaml");
}

export { swaggerSpec };
