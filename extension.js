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

      vscode.window.showInformationMessage(
        "Menginisialisasi project dengan Sequelize...",
      );

      // Update Install: Tambahkan sequelize & cors
      exec(
        "npm init -y && npm install express dotenv sequelize mysql2 jsonwebtoken bcryptjs cors && npm install --save-dev nodemon",
        { cwd: folder },
        (err) => {
          if (err)
            return vscode.window.showErrorMessage("Gagal menjalankan npm.");

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

          // ================== index.js (Added CORS & Sequelize Sync) ==================
          const indexContent = `
require('dotenv').config()
const PORT = process.env.PORT || 5000;
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');

const app = express();

app.use(cors()); // Tambahan CORS
app.use(express.json());

// Auto routes
const authRoutes = require('./routes/authRoutes');
app.use('/auth', authRoutes);

// Tambahkan route otomatis di sini

app.use((err, req, res, next) => {
    res.status(500).json({ message: err.message })
})

// Koneksi Database & Sync
sequelize.sync({ alter: true })
  .then(() => {
    console.log('Database connected & synced');
    app.listen(PORT, () => console.log(\`Server berjalan di port \${PORT}\`));
  })
  .catch(err => console.log('Database Error: ' + err));
`;
          fs.writeFileSync(path.join(srcDir, "index.js"), indexContent.trim());

          // ================== database.js (Sequelize) ==================
          const dbContent = `
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    logging: false,
  }
);

module.exports = sequelize;
`;
          fs.writeFileSync(
            path.join(srcDir, "config", "database.js"),
            dbContent.trim(),
          );

          // ================== Default User Model (For Auth) ==================
          const userModel = `
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false }
}, { underscored: true });

module.exports = User;
`;
          fs.writeFileSync(
            path.join(srcDir, "models", "userModels.js"),
            userModel.trim(),
          );

          // ================== authController.js (Sequelize Pattern) ==================
          const authController = `
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/userModels");

async function register(req, res) {
    const { name, email, password } = req.body;
    try {
        const hashed = bcrypt.hashSync(password, 10);
        const user = await User.create({ name, email, password: hashed });
        res.json({ message: "Register success", data: { id: user.id, email: user.email } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function login(req, res) {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(400).json({ message: "Email not found" });

        const valid = bcrypt.compareSync(password, user.password);
        if (!valid) return res.status(400).json({ message: "Wrong password" });

        const token = jwt.sign({ id: user.id, email: user.email }, process.env.APP_KEY, { expiresIn: "1d" });
        res.json({ message: "Login success", token });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

function logout(req, res) {
    res.json({ message: "Logout success" });
}

module.exports = { register, login, logout };
`;
          fs.writeFileSync(
            path.join(srcDir, "controller", "authController.js"),
            authController.trim(),
          );

          // File lainnya (key.js, jwtMiddleware, authRoutes, .gitignore, env.example)
          // Tetap sama seperti sebelumnya...
          generateOtherFiles(folder, srcDir);

          // Update package.json scripts
          const packageJsonPath = path.join(folder, "package.json");
          const packageJson = JSON.parse(
            fs.readFileSync(packageJsonPath, "utf8"),
          );
          packageJson.main = "src/index.js";
          packageJson.scripts = {
            start: "node src/index.js",
            dev: "nodemon src/index.js",
            "key:generate": "node src/config/key.js",
          };
          fs.writeFileSync(
            packageJsonPath,
            JSON.stringify(packageJson, null, 2),
          );

          vscode.window.showInformationMessage(
            "Project Sequelize berhasil dibuat!",
          );
        },
      );
    },
  );

  // ===============================
  // COMMAND 2: ADD ENDPOINT (Sequelize Version)
  // ===============================
  let addEndpoint = vscode.commands.registerCommand(
    "extension.addEndpoint",
    async () => {
      const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!folder) return vscode.window.showErrorMessage("Buka folder dulu!");

      const endpoint = await vscode.window.showInputBox({
        placeHolder: "Contoh: products",
      });
      if (!endpoint) return;

      const useJWT = await vscode.window.showQuickPick(["Yes", "No"], {
        placeHolder: "Gunakan JWT?",
      });
      const name = endpoint.toLowerCase();
      const capName = capitalize(name);

      const controllerPath = path.join(
        folder,
        "src",
        "controller",
        `${name}Controller.js`,
      );
      const modelPath = path.join(folder, "src", "models", `${name}Models.js`);
      const routePath = path.join(folder, "src", "routes", `${name}Routes.js`);
      const indexPath = path.join(folder, "src", "index.js");

      // =================== MODEL (Sequelize Define) ===================
      const modelContent = `
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ${capName} = sequelize.define('${capName}', {
    name: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    address: { type: DataTypes.TEXT }
}, { 
    underscored: true,
    paranoid: true, // Soft Delete aktif
    defaultScope: { attributes: { exclude: ['createdAt', 'updatedAt', 'deletedAt'] } }
});

module.exports = ${capName};
`;

      // =================== CONTROLLER (Sequelize Methods) ===================
      const controllerContent = `
const ${capName} = require('../models/${name}Models');

const getAll${capName} = async (req, res) => {
    try {
        const data = await ${capName}.findAll();
        res.json({ message: 'Success', data });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const createNew${capName} = async (req, res) => {
    try {
        const data = await ${capName}.create(req.body);
        res.status(201).json({ message: 'Created', data });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const update${capName} = async (req, res) => {
    const { id${capName} } = req.params;
    try {
        await ${capName}.update(req.body, { where: { id: id${capName} } });
        res.json({ message: 'Updated' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const delete${capName} = async (req, res) => {
    const { id${capName} } = req.params;
    try {
        await ${capName}.destroy({ where: { id: id${capName} } });
        res.json({ message: 'Deleted (Soft Delete)' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = { getAll${capName}, createNew${capName}, update${capName}, delete${capName} };
`;

      // =================== ROUTE ===================
      const protectedMiddleware = useJWT === "Yes" ? "verifyToken," : "";
      const routeContent = `
const express = require('express');
const ${capName}Controller = require('../controller/${name}Controller');
${useJWT === "Yes" ? "const verifyToken = require('../middleware/jwtMiddleware');" : ""}

const router = express.Router();

router.get('/', ${protectedMiddleware} ${capName}Controller.getAll${capName});
router.post('/', ${protectedMiddleware} ${capName}Controller.createNew${capName});
router.patch('/:id${capName}', ${protectedMiddleware} ${capName}Controller.update${capName});
router.delete('/:id${capName}', ${protectedMiddleware} ${capName}Controller.delete${capName});

module.exports = router;
`;

      fs.writeFileSync(controllerPath, controllerContent.trim());
      fs.writeFileSync(modelPath, modelContent.trim());
      fs.writeFileSync(routePath, routeContent.trim());

      // Update index.js (Logic same as before)
      updateIndexRoutes(indexPath, name);

      vscode.window.showInformationMessage(
        `Endpoint "${name}" dengan Sequelize berhasil dibuat!`,
      );
    },
  );

  context.subscriptions.push(initProject, addEndpoint);
}

// Helper Functions
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function updateIndexRoutes(indexPath, name) {
  let content = fs.readFileSync(indexPath, "utf8");
  const importLine = `const ${name}Routes = require('./routes/${name}Routes');`;
  const useLine = `app.use('/${name}', ${name}Routes);`;
  if (!content.includes(importLine)) {
    content = content.replace(
      "// Tambahkan route otomatis di sini",
      `${importLine}\n// Tambahkan route otomatis di sini`,
    );
  }
  if (!content.includes(useLine)) {
    content = content.replace(
      "// Tambahkan route otomatis di sini",
      `// Tambahkan route otomatis di sini\n${useLine}`,
    );
  }
  fs.writeFileSync(indexPath, content);
}

function generateOtherFiles(folder, srcDir) {
  // Isi fungsi ini sama dengan isi file key.js, jwtMiddleware, dll
  // yang ada di kode awal Anda agar tidak terlalu panjang di sini.
}

module.exports = { activate, deactivate: () => {} };
