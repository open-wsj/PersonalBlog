---
title: "Ubuntu 自动登录后 GNOME 远程桌面连不上？一次登录钥匙环锁定的排查与永久修复"
abbrlink: ubuntu-zi-dong-deng-lu-hou-gnome-yuan-cheng-zhuo-mian-lian
date: "2026-11-03 20:07:42"
categories:
    - "Linux 桌面"
tags: []
desc: "自动登录 + GNOME 远程桌面「连不上但解锁后能用」，几乎都是登录钥匙环被锁定导致的判断依据是 GRD 日志里的…"
---
> 环境：Ubuntu 26.04.1 LTS / GNOME Shell 50.1 / gnome-remote-desktop 50.2（Wayland 会话）
> 现象关键词：`[RDP] Credentials are not set, denying client`、设置里「远程桌面」显示「部分设置已锁定 / 解锁」

---

### 一、问题现象

开启了系统自带的远程桌面：

-   设置 → 系统 → 远程桌面 → **桌面共享**：开
-   **远程控制**：开
-   RDP 端口 3389 正常监听

但从其他设备用 RDP 客户端连接时始终失败。奇怪的是，只要打开一次「设置 → 远程桌面」，在弹出的框里输入密码解锁，之后就能正常连上；重启电脑后又要重复这一操作。

### 二、排查过程

#### 1. 服务与端口正常

```bash
systemctl --user status gnome-remote-desktop
ss -lntp | grep 3389
grdctl status
```

输出显示用户级 `gnome-remote-desktop.service` 处于 running，3389 也在监听，RDP 后端为 enabled，认证方式为 credentials。说明不是服务没起来，也不是防火墙问题。

#### 2. 日志暴露真正原因

```bash
journalctl --user -u gnome-remote-desktop -b --no-pager
```

每次客户端连接都会出现：

```
[RDP] Credentials are not set, denying client
```

也就是说，远程桌面守护进程认为自己「没有设置用户名密码」，于是在认证阶段直接拒绝连接。但从 `grdctl status` 看，凭据明明是配置过的。

#### 3. 锁定状态与设置面板对应

`gnome-control-center` 的远程桌面页面里有一段逻辑：

-   登录钥匙环被锁定时，页面顶部会出现信息条「部分设置已锁定（Some settings are locked）」，右侧是「解锁（Unlock）」按钮
-   解锁后，页面才能读写保存的 RDP 凭据

这与现象完全对应：**每次开机后钥匙环是锁定的，GRD 读不到凭据；手动解锁后立刻恢复。**

### 三、根因

三个事实叠加导致：

1.  系统开启了 GDM 自动登录：

```ini
# /etc/gdm3/custom.conf
AutomaticLoginEnable=True
AutomaticLogin=wsj
```

2.  GNOME 远程桌面（GRD 50）把 RDP 的用户名/密码保存在**登录钥匙环**（libsecret，条目 schema 为 `org.gnome.RemoteDesktop.RdpCredentials`），而不是明文配置文件。

3.  自动登录时 PAM 没有密码可传给 `pam_gnome_keyring`，登录钥匙环保持锁定。于是：

> 自动登录 → 钥匙环锁定 → GRD 读不到凭据 → RDP 拒绝所有客户端
> 手动解锁钥匙环 → GRD 读到凭据 → 连接恢复（无需重启 GRD）

所以「打开设置输入密码」不是开启了什么开关，而是**解锁了登录钥匙环**。

### 四、方案选择

| 方案 | 效果 | 代价 |
| --- | --- | --- |
| 关闭 GDM 自动登录 | 登录时 PAM 自动解锁钥匙环，一劳永逸 | 每次开机必须在登录界面输入密码 |
| 保留自动登录 + 开机自动解锁钥匙环 | 随时可远程连接 | 登录密码需以本机可读形式保存 |
| 改用系统级「远程登录」 | 不依赖用户钥匙环 | 连的是新会话，不是当前桌面 |

本文采用第二种，并尽量做得「干净」：不修改 PAM、不修改系统自带 unit 文件，只加用户级 systemd drop-in。

### 五、具体操作

#### 1. 保存登录密码（务必去掉结尾换行）

登录钥匙环的密码一般就是登录密码。先把它保存到仅当前用户可读的文件：

```bash
f="$HOME/.config/gnome-keyring-unlock.pass"

# 交互输入，不落到 shell 历史
read -rsp '请输入登录密码: ' kp
printf '%s' "$kp" > "$f"
unset kp
chmod 600 "$f"
echo
```

> 注意：`printf '%s'` 不追加换行。**如果文件末尾带 `\n`，解锁会失败**（后文踩坑记录有详细说明）。

#### 2. 给钥匙环服务加 drop-in

新建：

```
~/.config/systemd/user/gnome-keyring-daemon.service.d/unlock-after-autologin.conf
```

内容：

```ini
# 自动登录场景：启动钥匙环守护进程时直接读取保存的密码解锁登录钥匙环
# 若密码文件不存在，则退回系统默认行为（锁定状态启动）
[Service]
ExecStart=
ExecStart=/bin/sh -c 'f=%h/.config/gnome-keyring-unlock.pass; if [ -r "$f" ]; then exec /usr/bin/gnome-keyring-daemon --foreground --components=pkcs11,secrets --control-directory=%t/keyring --unlock < "$f"; else exec /usr/bin/gnome-keyring-daemon --foreground --components=pkcs11,secrets --control-directory=%t/keyring; fi'
```

要点：

-   先写空的 `ExecStart=` 清空原有启动命令，再追加新的
-   `%h` = 用户家目录，`%t` = 用户运行时目录（如 `/run/user/1000`）
-   用 `exec` 让守护进程成为该 unit 的主进程，保持 systemd 的 socket 激活与生命周期管理
-   密码文件不存在时回退到系统默认行为，避免把钥匙环彻底搞坏

#### 3. 生效

```bash
systemctl --user daemon-reload
systemctl --user restart gnome-keyring-daemon.service
```

#### 4. 验证

查看是否还有解锁失败日志：

```bash
journalctl --user -u gnome-keyring-daemon.service -b --no-pager | tail
```

正常时不应出现：

```
failed to unlock login keyring on startup
```

再用 libsecret 直接查询钥匙环状态：

```bash
python3 - <<'PY'
import gi
gi.require_version('Secret', '1')
from gi.repository import Secret

s = Secret.Service.get_sync(Secret.ServiceFlags.LOAD_COLLECTIONS, None)
for c in s.get_collections():
    if c.get_label() == 'Login':
        print('Login locked =', c.get_locked())
        for i in c.get_items():
            if 'RemoteDesktop' in i.get_attributes().get('xdg:schema', ''):
                print('RDP 凭据 locked =', i.get_locked())
PY
```

期望输出：

```
Login locked = False
RDP 凭据 locked = False
```

为了模拟「重启后的状态」，可以先主动锁定钥匙环再启动服务：

```bash
gdbus call --session --dest org.freedesktop.secrets \
  --object-path /org/freedesktop/secrets \
  --method org.freedesktop.Secret.Service.Lock \
  "['/org/freedesktop/secrets/collection/login']"

systemctl --user restart gnome-keyring-daemon.service
```

如果重启后 `Login locked = False`，说明自动解锁链路已经打通。

### 六、踩坑记录（很有参考价值）

#### 1. 密码文件末尾多一个换行就失败

最初的实现是把密码原样写入文件（末尾有 `\n`），结果启动日志报：

```
failed to unlock login keyring on startup
```

`gnome-keyring-daemon --unlock` 从 stdin 读取密码时，会把换行一起当成密码内容。改成 `printf '%s' "$(cat file)"` 去掉换行后立刻成功。

#### 2. `--unlock` 不能作用于已经运行的实例

钥匙环守护进程由 PAM / systemd socket 先启动，此时再执行：

```bash
gnome-keyring-daemon --unlock --components=secrets
```

并不会让已运行的实例去解锁，而是尝试再起一个实例，日志出现：

```
another secret service is running
```

`--replace` 也未必可靠（旧进程仍持有 D-Bus 名称）。真正有效的做法是让 systemd 用带 `--unlock` 的命令直接启动主进程，即本文的 drop-in 方案。

#### 3. D-Bus 服务文件会绕过 systemd unit

`/usr/share/dbus-1/services/org.freedesktop.secrets.service` 里写的是：

```
Exec=/usr/bin/gnome-keyring-daemon --start --foreground --components=secrets
```

如果某个客户端在 unit 启动前先请求 Secret Service，就会绕过 systemd 直接拉起一个「锁定状态」的守护进程，导致你的 drop-in 看起来没生效。

但在**真实登录**过程中，是 PAM 的 `pam_gnome_keyring.so auto_start` 先触发 socket，从而启动 `gnome-keyring-daemon.service`，drop-in 正常生效。手动测试时要注意这一点，不要用「主动访问 Secret Service」来模拟开机登录。

#### 4. 用 `pkill -f` 清理守护进程会误杀自己

排查时曾用：

```bash
pkill -f gnome-keyring-daemon
```

结果连包含这串字符的 shell 命令行进程一起被杀了（工具/脚本自身命令行里也带着这个字符串）。如果要按进程清理，请锚定命令行开头或完整路径，例如：

```bash
pkill -u "$(id -u)" -f '^(/usr/bin/)?gnome-keyring-daemon'
```

### 七、回滚

想恢复系统默认行为：

```bash
rm -rf ~/.config/systemd/user/gnome-keyring-daemon.service.d
rm -f ~/.config/gnome-keyring-unlock.pass
systemctl --user daemon-reload
systemctl --user restart gnome-keyring-daemon.service
```

之后在自动登录场景下又会回到「每次需要手动解锁」的状态。

### 八、安全提示

该方案本质上把登录密码以可读形式保存在本机（文件权限 600，仅当前用户和 root 可读）。这是保留免密自动登录的必然代价：

-   任何以该用户身份运行的进程都能读取该文件
-   root 自然也可以读取

如果无法接受这一点，应关闭 GDM 自动登录，让 PAM 在登录时用真实密码解锁钥匙环：

```ini
# /etc/gdm3/custom.conf
AutomaticLoginEnable=False
```

### 九、总结

-   自动登录 + GNOME 远程桌面「连不上但解锁后能用」，几乎都是**登录钥匙环被锁定**导致的
-   判断依据是 GRD 日志里的 `Credentials are not set, denying client`，以及设置页面顶部的「部分设置已锁定」
-   修复思路是让钥匙环守护进程在启动时就带着密码解锁，最干净的做法是给 `gnome-keyring-daemon.service` 加用户级 drop-in
-   两个关键细节：密码文件不能带结尾换行；`--unlock` 必须作用于「启动瞬间」的守护进程，而不是已运行的实例
