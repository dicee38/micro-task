const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const express = require("express");

const router = express.Router();
const swaggerDocument = YAML.load("./docs/openapi.yaml");

router.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

module.exports = router;
