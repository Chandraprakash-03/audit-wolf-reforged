import request from "supertest";
import { app } from "../index";

describe("Swagger Documentation", () => {
	it("should serve Swagger UI at /api-docs", async () => {
		const response = await request(app).get("/api-docs/").expect(200);

		expect(response.text).toContain("swagger-ui");
		expect(response.text).toContain("Audit Wolf API");
	});

	it("should serve OpenAPI JSON spec at /api-docs.json", async () => {
		const response = await request(app).get("/api-docs.json").expect(200);

		expect(response.body.openapi).toBe("3.0.3");
		expect(response.body.info.title).toBe("Audit Wolf API");
		expect(response.body.info.version).toBe("1.0.0");
	});

	it("should serve OpenAPI YAML spec at /api-docs.yaml", async () => {
		const response = await request(app).get("/api-docs.yaml").expect(200);

		expect(response.text).toContain("openapi: 3.0.3");
		expect(response.text).toContain("title: 'Audit Wolf API'");
	});

	it("should include all major API endpoints in documentation", async () => {
		const response = await request(app).get("/api-docs.json").expect(200);

		const paths = Object.keys(response.body.paths);

		// Check that major endpoints are documented
		expect(paths).toContain("/health");
		expect(paths).toContain("/auth/login");
		expect(paths).toContain("/auth/register");
		expect(paths).toContain("/contracts");
		expect(paths).toContain("/contracts/{id}");
		expect(paths).toContain("/analysis/start");
		expect(paths).toContain("/analysis/{auditId}/progress");
		expect(paths).toContain("/reports/generate");
	});

	it("should include proper security schemes", async () => {
		const response = await request(app).get("/api-docs.json").expect(200);

		expect(response.body.components.securitySchemes).toBeDefined();
		expect(response.body.components.securitySchemes.BearerAuth).toBeDefined();
		expect(response.body.components.securitySchemes.BearerAuth.type).toBe(
			"http"
		);
		expect(response.body.components.securitySchemes.BearerAuth.scheme).toBe(
			"bearer"
		);
	});
});
