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

      vscode.window.showInformationMessage("Menginisialisasi project...");

      // Install express, dotenv, mysql2, jsonwebtoken
      exec(
        "npm init -y && npm install express dotenv mysql2 jsonwebtoken bcryptjs && npm install --save-dev nodemon",
        { cwd: folder },
        (err) => {
          if (err)
            return vscode.window.showErrorMessage("Gagal menjalankan npm.");

          // Folder structure
          const srcDir = path.join(folder, "src");
          const dirs = [
            "controller",
            "middleware",
            "models",
            "routes",
            "config",
          ];
          if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir);

          dirs.forEach((d) => {
            const dirPath = path.join(srcDir, d);
            if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath);
          });

          // ================== index.js ==================
          const indexContent = `
require('dotenv').config()
const PORT = process.env.PORT || 5000;
const express = require('express');

const app = express();
app.use(express.json());

// Auto routes
const authRoutes = require('./routes/authRoutes');
app.use('/auth', authRoutes);

// Tambahkan route otomatis di sini

app.use((err, req, res, next) => {
    res.json({ message: err.message })
})

app.listen(PORT, () => {
    console.log(\`Server berjalan di port \${PORT}\`);
})
`;
          fs.writeFileSync(path.join(srcDir, "index.js"), indexContent.trim());

          // ================== database.js ==================
          const dbContent = `
const mysql = require("mysql2");

const dbPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

module.exports = dbPool.promise();
`;
          fs.writeFileSync(
            path.join(srcDir, "config", "database.js"),
            dbContent.trim()
          );

          // ================== key.js generator ==================
          const keyJsContent = `
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const envPath = path.resolve(__dirname, "../../.env");

function generateAppKey(length = 32) {
  return crypto.randomBytes(length).toString("hex");
}

function replaceEnvKey(newKey) {
  if (!fs.existsSync(envPath)) {
    console.error(".env file tidak ditemukan!");
    process.exit(1);
  }

  let envContent = fs.readFileSync(envPath, "utf-8");

  if (envContent.includes("APP_KEY=")) {
    envContent = envContent.replace(/APP_KEY=.*/g, \`APP_KEY="\${newKey}"\`);
  } else {
    envContent += \`\\nAPP_KEY="\${newKey}"\\n\`;
  }

  fs.writeFileSync(envPath, envContent, "utf-8");
  console.log("APP_KEY updated!");
}

const newKey = generateAppKey(32);
replaceEnvKey(newKey);
`;
          fs.writeFileSync(
            path.join(srcDir, "config", "key.js"),
            keyJsContent.trim()
          );

          // ================== JWT Middleware ==================
          const jwtMiddleware = `
const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Unauthorized: Token missing" });
    }

    try {
        const decoded = jwt.verify(token, process.env.APP_KEY);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid token" });
    }
}

module.exports = verifyToken;
`;
          fs.writeFileSync(
            path.join(srcDir, "middleware", "jwtMiddleware.js"),
            jwtMiddleware.trim()
          );

          // ================== Auth Controller ==================
          const authController = `
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/database");

async function register(req, res) {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
        return res.status(400).json({ message: "Missing fields" });

    const hashed = bcrypt.hashSync(password, 10);

    await db.execute(
        "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
        [name, email, hashed]
    );

    res.json({ message: "Register success" });
}

async function login(req, res) {
    const { email, password } = req.body;

    const [rows] = await db.execute(
        "SELECT * FROM users WHERE email = ? LIMIT 1",
        [email]
    );

    if (!rows.length)
        return res.status(400).json({ message: "Email not found" });

    const user = rows[0];

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(400).json({ message: "Wrong password" });

    const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.APP_KEY,
        { expiresIn: "1d" }
    );

    res.json({ message: "Login success", token });
}

function logout(req, res) {
    res.json({ message: "Logout success (client removes token)" });
}

module.exports = { register, login, logout };
`;
          fs.writeFileSync(
            path.join(srcDir, "controller", "authController.js"),
            authController.trim()
          );

          // ================== Auth Routes ==================
          const authRoutes = `
const express = require("express");
const Auth = require("../controller/authController");

const router = express.Router();

router.post("/login", Auth.login);
router.post("/register", Auth.register);
router.post("/logout", Auth.logout);

module.exports = router;
`;
          fs.writeFileSync(
            path.join(srcDir, "routes", "authRoutes.js"),
            authRoutes.trim()
          );

          // ================== env.example ==================
          fs.writeFileSync(
            path.join(folder, "env.example"),
            `PORT="5000"
DB_HOST="localhost"
DB_USERNAME="root"
DB_PASSWORD=""
DB_NAME="mydb"
APP_KEY="your_app_key_here"`
          );

          // .gitignore
          fs.writeFileSync(
            path.join(folder, ".gitignore"),
            `node_modules/
.env`
          );

          // ================== package.json update ==================
          const packageJsonPath = path.join(folder, "package.json");
          const packageJson = JSON.parse(
            fs.readFileSync(packageJsonPath, "utf8")
          );

          packageJson.main = "src/index.js";
          packageJson.scripts = {
            start: "node src/index.js",
            dev: "nodemon src/index.js",
            "key:generate": "node src/config/key.js",
          };

          fs.writeFileSync(
            packageJsonPath,
            JSON.stringify(packageJson, null, 2)
          );

          vscode.window.showInformationMessage("Project berhasil dibuat!");
        }
      );
    }
  );

  // ===============================
  // COMMAND 2: ADD ENDPOINT
  // ===============================
  let addEndpoint = vscode.commands.registerCommand(
    "extension.addEndpoint",
    async () => {
      const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!folder) return vscode.window.showErrorMessage("Buka folder dulu!");

      // Ask endpoint name
      const endpoint = await vscode.window.showInputBox({
        placeHolder: "Contoh: products",
        prompt: "Masukkan nama endpoint",
      });

      if (!endpoint) return;

      // Ask JWT usage
      const useJWT = await vscode.window.showQuickPick(["Yes", "No"], {
        placeHolder: "Gunakan JWT Middleware untuk endpoint ini?",
      });

      const name = endpoint.toLowerCase();

      const controllerPath = path.join(
        folder,
        "src",
        "controller",
        `${name}Controller.js`
      );
      const modelPath = path.join(folder, "src", "models", `${name}Models.js`);
      const routePath = path.join(folder, "src", "routes", `${name}Routes.js`);
      const indexPath = path.join(folder, "src", "index.js");

      const middlewareImport = `const verifyToken = require('../middleware/jwtMiddleware');`;

      const protectedMiddleware = useJWT === "Yes" ? "verifyToken," : "";

      // =================== ROUTE ===================
      const routeContent = `
const express = require('express');
const ${capitalize(
        name
      )}Controller = require('../controller/${name}Controller.js');
${useJWT === "Yes" ? middlewareImport : ""}

const router = express.Router();

router.post('/', ${protectedMiddleware} ${capitalize(
        name
      )}Controller.createNew${capitalize(name)});
router.get('/', ${protectedMiddleware} ${capitalize(
        name
      )}Controller.getAll${capitalize(name)});
router.patch('/:id${capitalize(name)}', ${protectedMiddleware} ${capitalize(
        name
      )}Controller.update${capitalize(name)});
router.delete('/:id${capitalize(name)}', ${protectedMiddleware} ${capitalize(
        name
      )}Controller.delete${capitalize(name)});

module.exports = router;
`;

      // =================== CONTROLLER ===================
      const controllerContent = `
const ${capitalize(name)}Model = require('../models/${name}Models');

const getAll${capitalize(name)} = async (req, res) => {
    try {
        const [data] = await ${capitalize(name)}Model.getAll${capitalize(
        name
      )}();
        res.json({ message: 'Success', data })
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error })
    }
}

const createNew${capitalize(name)} = async (req, res) => {
    const {body} = req;
    try {
        await ${capitalize(name)}Model.createNew${capitalize(name)}(body);
        res.status(201).json({ message: 'Created', data: body })
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error })
    }
}

const update${capitalize(name)} = async (req, res) => {
    const {id${capitalize(name)}} = req.params;
    const {body} = req;
    try {
        await ${capitalize(name)}Model.update${capitalize(
        name
      )}(body, id${capitalize(name)});
        res.json({ message: 'Updated', data: { id: id${capitalize(
          name
        )}, ...body } })
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error })
    }
}

const delete${capitalize(name)} = async (req, res) => {
    const {id${capitalize(name)}} = req.params;
    try {
        await ${capitalize(name)}Model.delete${capitalize(name)}(id${capitalize(
        name
      )});
        res.json({ message: 'Deleted' })
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error })
    }
}

module.exports = {
    getAll${capitalize(name)},
    createNew${capitalize(name)},
    update${capitalize(name)},
    delete${capitalize(name)},
}
`;

      // =================== MODEL ===================
      const modelContent = `
const dbPool = require('../config/database');

const getAll${capitalize(name)} = () => {
    return dbPool.execute('SELECT * FROM ${name}');
}

const createNew${capitalize(name)} = (body) => {
    return dbPool.execute(
        "INSERT INTO ${name} (name, email, address) VALUES (?, ?, ?)",
        [body.name, body.email, body.address]
    );
}

const update${capitalize(name)} = (body, id${capitalize(name)}) => {
    return dbPool.execute(
        "UPDATE ${name} SET name=?, email=?, address=? WHERE id=?",
        [body.name, body.email, body.address, id${capitalize(name)}]
    );
}

const delete${capitalize(name)} = (id${capitalize(name)}) => {
    return dbPool.execute("DELETE FROM ${name} WHERE id=?", [id${capitalize(
        name
      )}]);
}

module.exports = {
    getAll${capitalize(name)},
    createNew${capitalize(name)},
    update${capitalize(name)},
    delete${capitalize(name)},
}
`;

      // Write files
      fs.writeFileSync(controllerPath, controllerContent.trim());
      fs.writeFileSync(modelPath, modelContent.trim());
      fs.writeFileSync(routePath, routeContent.trim());

      // Update index.js
      let indexContent = fs.readFileSync(indexPath, "utf8");

      const importLine = `const ${name}Routes = require('./routes/${name}Routes');`;
      const useLine = `app.use('/${name}', ${name}Routes);`;

      if (!indexContent.includes(importLine)) {
        indexContent = indexContent.replace(
          "// Tambahkan route otomatis di sini",
          `${importLine}\n// Tambahkan route otomatis di sini`
        );
      }

      if (!indexContent.includes(useLine)) {
        indexContent = indexContent.replace(
          "// Tambahkan route otomatis di sini",
          `// Tambahkan route otomatis di sini\n${useLine}`
        );
      }

      fs.writeFileSync(indexPath, indexContent);

      vscode.window.showInformationMessage(
        `Endpoint "${name}" berhasil dibuat!`
      );
    }
  );

  context.subscriptions.push(initProject, addEndpoint);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function deactivate() {}

module.exports = { activate, deactivate };
