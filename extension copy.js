const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

function activate(context) {
  console.log("Express API Generator active");

  // ===============================
  // COMMAND 1: INIT PROJECT
  // ===============================
  let initProject = vscode.commands.registerCommand(
    "extension.initProject",
    async () => {
      const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!folder) return vscode.window.showErrorMessage("Buka folder dulu!");

      const dbChoice = await vscode.window.showQuickPick(
        ["MySQL", "PostgreSQL", "MariaDB", "SQLite"],
        {
          placeHolder: "Pilih Database",
        },
      );

      let dbDriver = "";
      let dbDialect = "";

      switch (dbChoice) {
        case "MySQL":
          dbDriver = "mysql2";
          dbDialect = "mysql";
          break;

        case "PostgreSQL":
          dbDriver = "pg pg-hstore";
          dbDialect = "postgres";
          break;

        case "MariaDB":
          dbDriver = "mariadb";
          dbDialect = "mariadb";
          break;

        case "SQLite":
          dbDriver = "sqlite3";
          dbDialect = "sqlite";
          break;
      }

      vscode.window.showInformationMessage(
        "Menginisialisasi project lengkap...",
      );

      exec(
        `npm init -y && npm install express dotenv sequelize ${dbDriver} jsonwebtoken bcryptjs cors swagger-jsdoc swagger-ui-express joi && npm install --save-dev nodemon sequelize-cli`,
        { cwd: folder },
        (err) => {
          if (err)
            return vscode.window.showErrorMessage("Gagal menjalankan npm.");

          const srcDir = path.join(folder, "src");
          const dirs = [
            "docs",
            "controller",
            "service",
            "middleware",
            "models",
            "routes",
            "config",
            "validators",
            "migrations",
          ];
          if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir);

          dirs.forEach((d) => {
            const dirPath = path.join(srcDir, d);
            if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath);
          });

          // 1. src/index.js
          const indexContent = `
require('dotenv').config()
const PORT = process.env.PORT || 5000;
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const app = express();

app.use(cors());
app.use(express.json());

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/openapi.json", (req, res) => res.json(swaggerSpec));

const appName = process.env.APP_NAME || "Scalar";
app.get("/scalar", (req, res) => {
  res.send(\`
    <!doctype html>
    <html>
      <head>
        <title>\${appName} API Docs</title>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />

        <style>
          body {
            margin: 0;
          }
        </style>
      </head>

      <body>
        <script
          id="api-reference"
          data-url="/openapi.json"
          src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"
        ></script>
      </body>
    </html>
  \`);
});

const authRoutes = require('./routes/authRoutes');
app.use('/auth', authRoutes);

// Tambahkan route otomatis di sini

app.use((err, req, res, next) => {
    res.status(500).json({ message: err.message })
})

app.listen(PORT, () => {
    console.log(\`Server berjalan di port \${PORT}\`);
    console.log(\`Swagger berjalan pada url http://localhost:\${PORT}/docs\`);
    console.log(\`Scalar berjalan pada url http://localhost:\${PORT}/scalar\`);
});
`;
          fs.writeFileSync(path.join(srcDir, "index.js"), indexContent.trim());

          // 2. src/config/swagger.js
          const swaggerConfig = `
const swaggerJSDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Express API Documentation",
      version: "1.0.0",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        }
      }
    }
  },
  apis: ["./src/routes/*.js", "./src/docs/*.js"], 
};

module.exports = swaggerJSDoc(options);
`;
          fs.writeFileSync(
            path.join(srcDir, "config", "swagger.js"),
            swaggerConfig.trim(),
          );

          // 3. src/config/database.js
          const dbContent = `
const { Sequelize } = require("sequelize");

let sequelize;

if (process.env.DB_DIALECT === "sqlite") {
  sequelize = new Sequelize({
    dialect: "sqlite",
    storage: "./database.sqlite",
    logging: false,
  });
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USERNAME,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      dialect: process.env.DB_DIALECT,
      logging: false,
    }
  );
}

module.exports = sequelize;
`;
          fs.writeFileSync(
            path.join(srcDir, "config", "database.js"),
            dbContent.trim(),
          );

          // 4. src/config/key.js
          const keyContent = `
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const envPath = path.resolve(__dirname, "../../.env");

const newKey = crypto.randomBytes(32).toString("hex");
let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

if (envContent.includes("APP_KEY=")) {
  envContent = envContent.replace(/APP_KEY=.*/g, \`APP_KEY="\${newKey}"\`);
} else {
  envContent += \`\\nAPP_KEY="\${newKey}"\\n\`;
}
fs.writeFileSync(envPath, envContent, "utf-8");
console.log("APP_KEY Generated");
`;
          fs.writeFileSync(
            path.join(srcDir, "config", "key.js"),
            keyContent.trim(),
          );

          // 5. src/middleware/jwtMiddleware.js
          const jwtContent = `
const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid token" });
    }
};
`;
          fs.writeFileSync(
            path.join(srcDir, "middleware", "jwtMiddleware.js"),
            jwtContent.trim(),
          );

          // 6. src/docs/authDocs.js (Dokumentasi Auth Terpisah)
          const authDocs = `
/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register success
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Success
 */

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login success
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Success
 */

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */

module.exports = {};
`;
          fs.writeFileSync(
            path.join(srcDir, "docs", "authDocs.js"),
            authDocs.trim(),
          );

          // 7. Models & Routes Auth
          const userModel = `const { DataTypes } = require('sequelize');\nconst sequelize = require('../config/database');\nmodule.exports = sequelize.define('User', { name: { type: DataTypes.STRING }, email: { type: DataTypes.STRING, unique: true }, password: { type: DataTypes.STRING } }, { underscored: true });`;
          const refreshTokenModel = `
const { DataTypes } = require('sequelize');

const sequelize = require('../config/database');

const User = require('./userModels');

const RefreshToken = sequelize.define(
  'RefreshToken',
  {
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    token: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    underscored: true,
    paranoid: true,
  }
);

RefreshToken.belongsTo(User, {
  foreignKey: 'user_id',
});

User.hasMany(RefreshToken, {
  foreignKey: 'user_id',
});

module.exports = RefreshToken;
`;
          fs.writeFileSync(
            path.join(srcDir, "models", "userModels.js"),
            userModel.trim(),
          );
          fs.writeFileSync(
            path.join(srcDir, "models", "refreshTokenModels.js"),
            refreshTokenModel.trim(),
          );

          fs.writeFileSync(
            path.join(srcDir, "routes", "authRoutes.js"),
            `const express = require("express");\nconst Auth = require("../controller/authController");\nconst router = express.Router();\nrouter.post("/register", Auth.register);\nrouter.post("/login", Auth.login);\nrouter.post("/refresh", Auth.refresh);\nrouter.post("/logout", Auth.logout);module.exports = router;`,
          );

          const authServiceContent = `
const jwt = require('jsonwebtoken');

const bcrypt = require('bcryptjs');

const User = require('../models/userModels');

const RefreshToken = require('../models/refreshTokenModels');

const register = async (payload) => {

    const hash = await bcrypt.hash(
        payload.password,
        10
    );

    const user = await User.create({
        name: payload.name,
        email: payload.email,
        password: hash,
    });

    return user;
};

const login = async (payload) => {

    const user = await User.findOne({
        where: {
            email: payload.email,
        },
    });

    if (!user) {
        throw new Error(
            'Email not found'
        );
    }

    const compare = await bcrypt.compare(
        payload.password,
        user.password
    );

    if (!compare) {
        throw new Error(
            'Wrong password'
        );
    }

    const jwtPayload = {
        id: user.id,
        email: user.email,
    };

    const accessToken = jwt.sign(
        jwtPayload,
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn:
                process.env.ACCESS_TOKEN_EXPIRED,
        }
    );

    const refreshToken = jwt.sign(
        jwtPayload,
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn:
                process.env.REFRESH_TOKEN_EXPIRED,
        }
    );

    await RefreshToken.create({
        user_id: user.id,
        token: refreshToken,
    });

    return {
        access_token: accessToken,
        refresh_token: refreshToken,
    };
};

const refresh = async (token) => {

    const tokenExist =
        await RefreshToken.findOne({
            where: {
                token,
            },
        });

    if (!tokenExist) {
        throw new Error(
            'Refresh token invalid'
        );
    }

    const decoded = jwt.verify(
        token,
        process.env.REFRESH_TOKEN_SECRET
    );

    const accessToken = jwt.sign(
        {
            id: decoded.id,
            email: decoded.email,
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn:
                process.env.ACCESS_TOKEN_EXPIRED,
        }
    );

    return {
        access_token: accessToken,
    };
};

const logout = async (token) => {

    await RefreshToken.destroy({
        where: {
            token,
        },
    });

    return true;
};

module.exports = {
    register,
    login,
    refresh,
    logout,
};
`;

          fs.writeFileSync(
            path.join(srcDir, "service", "authService.js"),
            authServiceContent.trim(),
          );

          const authControllerContent = `
const authService =
    require('../service/authService');

module.exports = {

    register: async (req, res) => {
        try {

            const data =
                await authService.register(
                    req.body
                );

            res.status(201).json({
                data,
            });

        } catch (e) {

            res.status(500).json({
                message: e.message,
            });

        }
    },

    login: async (req, res) => {
        try {

            const data =
                await authService.login(
                    req.body
                );

            res.json(data);

        } catch (e) {

            res.status(500).json({
                message: e.message,
            });

        }
    },

    refresh: async (req, res) => {
        try {

            const data =
                await authService.refresh(
                    req.body.refresh_token
                );

            res.json(data);

        } catch (e) {

            res.status(401).json({
                message: e.message,
            });

        }
    },

    logout: async (req, res) => {
        try {

            await authService.logout(
                req.body.refresh_token
            );

            res.json({
                message:
                    'Logout success',
            });

        } catch (e) {

            res.status(500).json({
                message: e.message,
            });

        }
    },

};
`;

          fs.writeFileSync(
            path.join(srcDir, "controller", "authController.js"),
            authControllerContent.trim(),
          );

          // 8. Files Pendukung
          fs.writeFileSync(
            path.join(folder, "env.example"),
            `APP_NAME=""
APP_KEY=""\n
PORT="5000"\n
DB_DIALECT="${dbDialect}"
DB_HOST="localhost"
DB_USERNAME="root"
DB_PASSWORD=""
DB_NAME="mydb"\n
ACCESS_TOKEN_SECRET=""
REFRESH_TOKEN_SECRET=""
ACCESS_TOKEN_EXPIRED="15m"
REFRESH_TOKEN_EXPIRED="7d"`,
          );
          fs.writeFileSync(
            path.join(folder, ".gitignore"),
            "node_modules/\n.env",
          );

          // 9. Middleware Validate
          const validateContent = `
module.exports = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);

        if (error) {
            return res.status(400).json({
                message: error.details[0].message
            });
        }

        next();
    };
};
`;

          fs.writeFileSync(
            path.join(srcDir, "middleware", "validate.js"),
            validateContent.trim(),
          );

          // 10. Migration and Seeder
          const sequelizeRc = `
const path = require('path');

module.exports = {
  config: path.resolve('src/config/database.js'),
  'models-path': path.resolve('src/models'),
  'seeders-path': path.resolve('src/seeders'),
  'migrations-path': path.resolve('src/migrations'),
};
`;

          fs.writeFileSync(
            path.join(folder, ".sequelizerc"),
            sequelizeRc.trim(),
          );

          const userMigration = `
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },

      name: {
        type: Sequelize.STRING,
      },

      email: {
        type: Sequelize.STRING,
        unique: true,
      },

      password: {
        type: Sequelize.STRING,
      },

      created_at: {
        type: Sequelize.DATE,
      },

      updated_at: {
        type: Sequelize.DATE,
      },

      deleted_at: {
        type: Sequelize.DATE,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};
`;

          fs.writeFileSync(
            path.join(srcDir, "migrations", `${Date.now()}-create-users.js`),
            userMigration.trim(),
          );

          const tokenMigration = `
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      'refresh_tokens',
      {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },

        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },

        token: {
          type: Sequelize.TEXT,
          allowNull: false,
        },

        created_at: {
          type: Sequelize.DATE,
        },

        updated_at: {
          type: Sequelize.DATE,
        },

        deleted_at: {
          type: Sequelize.DATE,
        },
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable(
      'refresh_tokens'
    );
  },
};
`;

          fs.writeFileSync(
            path.join(
              srcDir,
              "migrations",
              `${Date.now() + 1}-create-refresh-tokens.js`,
            ),
            tokenMigration.trim(),
          );

          const packageJsonPath = path.join(folder, "package.json");
          const packageJson = JSON.parse(
            fs.readFileSync(packageJsonPath, "utf8"),
          );

          packageJson.main = "src/index.js";
          packageJson.scripts = {
            start: "node src/index.js",
            dev: "nodemon src/index.js",
            "key:generate": "node src/config/key.js",
            migrate: "npx sequelize-cli db:migrate",
          };

          fs.writeFileSync(
            packageJsonPath,
            JSON.stringify(packageJson, null, 2),
          );

          vscode.window.showInformationMessage(
            "Project Berhasil Diinisialisasi!",
          );
        },
      );
    },
  );

  // ===============================
  // COMMAND 2: ADD ENDPOINT
  // ===============================
  let addEndpoint = vscode.commands.registerCommand(
    "extension.addEndpoint",
    async () => {
      const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!folder) return vscode.window.showErrorMessage("Buka folder dulu!");

      const endpoint = await vscode.window.showInputBox({
        placeHolder: "Nama endpoint (cth: products)",
      });
      if (!endpoint) return;

      const useJWT = await vscode.window.showQuickPick(["Yes", "No"], {
        placeHolder: "Gunakan JWT?",
      });

      const name = endpoint.toLowerCase();
      const capName = capitalize(name);

      const modelPath = path.join(folder, "src", "models", `${name}Models.js`);
      const servicePath = path.join(
        folder,
        "src",
        "service",
        `${name}Service.js`,
      );
      const controllerPath = path.join(
        folder,
        "src",
        "controller",
        `${name}Controller.js`,
      );
      const routePath = path.join(folder, "src", "routes", `${name}Routes.js`);
      const docsPath = path.join(folder, "src", "docs", `${name}Docs.js`);
      const validatorPath = path.join(
        folder,
        "src",
        "validators",
        `${name}Validation.js`,
      );
      const indexPath = path.join(folder, "src", "index.js");

      // --- Model ---
      fs.writeFileSync(
        modelPath,
        `const { DataTypes } = require('sequelize');\nconst sequelize = require('../config/database');\nmodule.exports = sequelize.define('${capName}', { name: { type: DataTypes.STRING }, description: { type: DataTypes.TEXT } }, { underscored: true, paranoid: true });`,
      );

      // --- Service ---
      fs.writeFileSync(
        servicePath,
        `const ${capName} = require('../models/${name}Models');\nmodule.exports = { getAll: async () => await ${capName}.findAll(), create: async (p) => await ${capName}.create(p), update: async (id, p) => await ${capName}.update(p, { where: { id } }), remove: async (id) => await ${capName}.destroy({ where: { id } }), findId: async (id) => await ${capName}.findOne({ where: { id } }) };`,
      );

      // --- Controller ---
      fs.writeFileSync(
        controllerPath,
        `const ${name}Service = require('../service/${name}Service');\nmodule.exports = { getAll: async (req, res) => { try { const data = await ${name}Service.getAll(); res.json({ data }); } catch (e) { res.status(500).json({ message: e.message }); } }, create: async (req, res) => { try { const data = await ${name}Service.create(req.body); res.status(201).json({ data }); } catch (e) { res.status(500).json({ message: e.message }); } }, update: async (req, res) => { try { await ${name}Service.update(req.params.id, req.body); res.json({ message: 'Updated' }); } catch (e) { res.status(500).json({ message: e.message }); } }, remove: async (req, res) => { try { await ${name}Service.remove(req.params.id); res.json({ message: 'Deleted' }); } catch (e) { res.status(500).json({ message: e.message }); } }, findId: async (req, res) => { try { const data = await ${name}Service.findId(req.params.id); res.json({ data }); } catch (e) { res.status(500).json({ message: e.message }); } } };`,
      );

      // --- Validation ---
      fs.writeFileSync(
        validatorPath,
        `
const Joi = require("joi");

const create${capName}Schema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().required()
});

const update${capName}Schema = Joi.object({
    name: Joi.string(),
    description: Joi.string()
});

module.exports = {
    create${capName}Schema,
    update${capName}Schema
};
`.trim(),
      );

      // --- Docs (Metode Dipisah-pisah per blok JSDoc) ---
      const docsContent = `
/**
 * @openapi
 * /${name}:
 *   get:
 *     tags: [${capName}]
 *     summary: Get all ${name}
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Success
 */

/**
 * @openapi
 * /${name}/{id}:
 *   get:
 *     tags: [${capName}]
 *     summary: Get by ID ${capName}
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */

/**
 * @openapi
 * /${name}:
 *   post:
 *     tags: [${capName}]
 *     summary: Create ${name}
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */

/**
 * @openapi
 * /${name}/{id}:
 *   patch:
 *     tags: [${capName}]
 *     summary: Update partial ${name}
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Updated
 */

/**
 * @openapi
 * /${name}/{id}:
 *   delete:
 *     tags: [${capName}]
 *     summary: Delete ${name}
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Deleted
 */

module.exports = {};
`;
      fs.writeFileSync(docsPath, docsContent.trim());

      // --- Route ---
      const routeContent = `
const express = require('express');
const ctrl = require('../controller/${name}Controller');

${
  useJWT === "Yes"
    ? "const auth = require('../middleware/jwtMiddleware');"
    : "const auth = (req,res,next) => next();"
}

const validate = require('../middleware/validate');

const {
  create${capName}Schema,
  update${capName}Schema
} = require('../validators/${name}Validation');

const router = express.Router();

router.get('/', auth, ctrl.getAll);

router.post(
  '/',
  auth,
  validate(create${capName}Schema),
  ctrl.create
);

router.get('/:id', auth, ctrl.findId);

router.patch(
  '/:id',
  auth,
  validate(update${capName}Schema),
  ctrl.update
);

router.delete('/:id', auth, ctrl.remove);

module.exports = router;
`;
      fs.writeFileSync(routePath, routeContent.trim());

      // Update index.js
      let indexContent = fs.readFileSync(indexPath, "utf8");
      const imp = `const ${name}Routes = require('./routes/${name}Routes');`;
      const use = `app.use('/${name}', ${name}Routes);`;
      if (!indexContent.includes(imp))
        indexContent = indexContent.replace(
          "// Tambahkan route otomatis di sini",
          `${imp}\n// Tambahkan route otomatis di sini`,
        );
      if (!indexContent.includes(use))
        indexContent = indexContent.replace(
          "// Tambahkan route otomatis di sini",
          `// Tambahkan route otomatis di sini\n${use}`,
        );
      fs.writeFileSync(indexPath, indexContent);

      vscode.window.showInformationMessage(`Endpoint & Docs "${name}" sukses!`);
    },
  );

  context.subscriptions.push(initProject, addEndpoint);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function deactivate() {}

module.exports = { activate, deactivate };
