# 待优化项

本文档记录未来可能需要优化的技术项，当前处于挂起状态。

---

## 1. 配置加密存储

### 问题描述

当前配置以明文形式存储在文件系统中，包含敏感信息如 qBittorrent 登录凭据。

**受影响配置**：

- qBittorrent API URL
- qBittorrent 用户名
- qBittorrent 密码（明文）

**存储位置**：

- macOS: `~/Library/Application Support/animefun.animefun/downloader.json`
- Linux: `~/.config/animefun.animefun/downloader.json`
- Windows: `%APPDATA%\animefun.animefun\downloader.json`

### 安全风险

#### 1. 文件系统权限问题

**共享环境风险**：

```bash
# 如果文件权限是 644（rw-r--r--）
-rw-r--r-- 1 user staff 123 Dec 25 10:00 downloader.json

# 同一机器的其他用户可以读取
cat ~/Library/Application\ Support/animefun.animefun/downloader.json
# 输出：{"api_url": "...", "username": "myuser", "password": "mypassword123"}
```

**云同步风险**：

- 配置文件可能被 iCloud、Dropbox、OneDrive 同步到云端
- 明文密码存储在云端服务器
- 云服务商员工可能访问

#### 2. 默认凭据硬编码

**问题代码**（`services/downloader/config.rs:15-23`）：

```rust
impl Default for DownloaderConfig {
    fn default() -> Self {
        Self {
            api_url: "http://localhost:8080".to_string(),
            username: Some("admin".to_string()),      // ❌ 硬编码
            password: Some("adminadmin".to_string()),  // ❌ 硬编码明文
        }
    }
}
```

**风险**：

- 用户可能不知道默认凭据，继续使用硬编码值
- 攻击者可以猜测常见密码（admin/admin, admin/123456）
- 源代码泄露会暴露默认凭据

#### 3. 日志泄露

**场景**：调试时打印配置

```rust
debug!("Downloader config: {:?}", config);
```

**日志输出**：

```
[DEBUG] Downloader config: DownloaderConfig {
    api_url: "http://localhost:8080",
    username: Some("myuser"),
    password: Some("mypassword123")  // ❌ 明文暴露
}
```

**风险**：

- 日志文件可能上传到 issue tracker
- 远程日志收集服务会存储明文密码

### 推荐方案

#### 方案 A：使用系统密钥环（推荐）

**依赖**：

```toml
[dependencies]
keyring = "2.3"
```

**实现示例**：

```rust
use keyring::{Entry, Error as KeyringError};

pub async fn save_config(config: DownloaderConfig) -> Result<(), AppError> {
    // 保存密码到系统密钥环
    let entry = Entry::new("animefun", "qBittorrent")?;
    if let Some(ref password) = config.password {
        entry.set_password(password)?;
    }

    // 只保存非敏感字段到文件
    let file_config = FileConfig {
        api_url: config.api_url,
        username: config.username,
        password: None,  // 不保存
    };
    let content = serde_json::to_string_pretty(&file_config)?;
    let path = default_app_dir().join("downloader.json");
    fs::write(path, content).await?;

    Ok(())
}

pub async fn get_config() -> Result<DownloaderConfig, AppError> {
    // 从文件加载非敏感配置
    let path = default_app_dir().join("downloader.json");
    let content = fs::read_to_string(&path).await.ok()
        .unwrap_or_else(|| serde_json::to_string_pretty(&FileConfig::default()).unwrap());
    let file_config: FileConfig = serde_json::from_str(&content)?;

    // 从系统密钥环加载密码
    let entry = Entry::new("animefun", "qBittorrent")?;
    let password = match entry.get_password() {
        Ok(pw) => Some(pw),
        Err(KeyringError::NoEntry) => None,
        Err(e) => return Err(AppError::Any(format!("Failed to get password: {}", e))),
    };

    Ok(DownloaderConfig {
        api_url: file_config.api_url,
        username: file_config.username,
        password,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FileConfig {
    api_url: String,
    username: Option<String>,
    password: Option<String>,  // 始终为 None
}
```

**优点**：

- ✅ 系统级安全（macOS Keychain、Windows Credential Manager）
- ✅ 跨应用共享（如果用户授权）
- ✅ 无需管理加密密钥
- ✅ 系统自动备份（iCloud 备份）
- ✅ 生物识别解锁（macOS Touch ID、Windows Hello）

**缺点**：

- 需要平台特定代码
- 增加外部依赖

#### 方案 B：使用 AES-256-GCM 加密

**依赖**：

```toml
[dependencies]
aes-gcm = "0.10"
base64 = "0.21"
rand = "0.8"
```

**实现示例**：

```rust
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use rand::RngCore;

struct EncryptedString(Vec<u8>);

impl EncryptedString {
    fn from_plain(plain: &str, key: &[u8; 32]) -> Result<Self> {
        let cipher = Aes256Gcm::new(key.into());
        let nonce = Aes256Gcm::generate_nonce(&mut rand::rngs::OsRng);
        let ciphertext = cipher.encrypt(&nonce, plain.as_bytes())
            .map_err(|e| AppError::Any(format!("Encryption failed: {}", e)))?;
        let combined = [nonce.as_slice(), &ciphertext].concat();
        Ok(Self(STANDARD.encode(combined).into_bytes()))
    }

    fn to_plain(&self, key: &[u8; 32]) -> Result<String> {
        let combined = STANDARD.decode(&self.0)
            .map_err(|e| AppError::Any(format!("Base64 decode failed: {}", e)))?;
        let (nonce, ciphertext) = combined.split_at(12);
        let cipher = Aes256Gcm::new(key.into());
        let plaintext = cipher.decrypt(nonce.into(), ciphertext)
            .map_err(|e| AppError::Any(format!("Decryption failed: {}", e)))?;
        String::from_utf8(plaintext)
            .map_err(|_| AppError::Any("Invalid UTF-8".into()))
    }
}

fn get_or_generate_key() -> Result<[u8; 32]> {
    let key_path = default_app_dir().join("encryption.key");
    if key_path.exists() {
        let key = fs::read(&key_path)?;
        key.try_into().map_err(|_| AppError::Any("Invalid key length".into()))
    } else {
        let mut key = [0u8; 32];
        rand::rngs::OsRng.fill_bytes(&mut key);
        fs::write(&key_path, &key)?;
        Ok(key)
    }
}

pub async fn get_config() -> Result<DownloaderConfig, AppError> {
    let key = get_or_generate_key()?;
    let path = default_app_dir().join("downloader.json");
    let content = fs::read_to_string(path).await.ok()
        .unwrap_or_else(|| serde_json::to_string_pretty(&DownloaderConfig::default()).unwrap());
    let mut config: DownloaderConfig = serde_json::from_str(&content)?;

    // 解密密码
    if let Some(encrypted) = config.password {
        let encrypted_str = String::from_utf8(encrypted)?;
        let password = EncryptedString(encrypted_str.into_bytes())
            .to_plain(&key)?;
        config.password = Some(password);
    }

    Ok(config)
}
```

**优点**：

- ✅ 跨平台统一实现
- ✅ 不依赖系统密钥环
- ✅ 可以控制加密算法

**缺点**：

- ❌ 需要安全地存储密钥文件
- ❌ 密钥文件可能被复制到其他机器
- ❌ 不如系统密钥环安全

### 实现步骤（简要）

#### 步骤 1：添加依赖

```toml
[dependencies]
keyring = "2.3"
```

#### 步骤 2：修改配置结构

```rust
// 移除默认凭据硬编码
impl Default for DownloaderConfig {
    fn default() -> Self {
        Self {
            api_url: "http://localhost:8080".to_string(),
            username: None,
            password: None,  // 默认为空
        }
    }
}
```

#### 步骤 3：修改保存/加载逻辑

- 使用 `Entry::new()` 创建密钥环条目
- 保存时：`entry.set_password(password)?`
- 加载时：`entry.get_password()?`

#### 步骤 4：添加迁移逻辑

```rust
pub async fn migrate_to_keyring() -> Result<(), AppError> {
    let old_path = default_app_dir().join("downloader.json");
    let content = fs::read_to_string(&old_path).await?;
    let old_config: DownloaderConfig = serde_json::from_str(&content)?;

    if old_config.password.is_some() {
        // 迁移到密钥环
        let entry = Entry::new("animefun", "qBittorrent")?;
        entry.set_password(old_config.password.as_deref().unwrap_or(""))?;

        // 从文件中移除密码
        let new_config = FileConfig {
            api_url: old_config.api_url,
            username: old_config.username,
            password: None,
        };
        let new_content = serde_json::to_string_pretty(&new_config)?;
        fs::write(&old_path, new_content).await?;

        info!("Migrated password from file to keyring");
    }

    Ok(())
}
```

#### 步骤 5：测试验证

- 测试保存/加载循环
- 测试不同平台（macOS/Windows/Linux）
- 测试错误场景（无密码、密钥环错误）

### 挂起原因

1. **优先级**：单机应用的安全风险相对较低
2. **复杂度**：需要处理多个平台的密钥环差异
3. **依赖管理**：`keyring` 库会增加额外依赖
4. **用户场景**：大多数用户在个人电脑上使用，共享场景较少

### 参考链接

- [keyring crate 文档](https://docs.rs/keyring/2/)
- [macOS Keychain Services](https://developer.apple.com/documentation/security/keychain_services)
- [Windows Credential Manager](https://docs.microsoft.com/en-us/windows/win32/api/wincred/)
- [libsecret (Linux)](https://wiki.gnome.org/Projects/Libsecret)

---

## 其他待优化项

<!-- 未来可以在这里添加其他优化项 -->
