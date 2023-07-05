// 运行在 Electron 主进程 下的插件入口
const { exec } = require("child_process");
const { Module } = require("module");


const original_load = Module._load;
Module._load = (...args) => {
    const loaded_module = original_load(...args);

    if (args[0] != "electron") {
        return loaded_module;
    }

    // Hook BrowserWindow
    class HookedBrowserWindow extends loaded_module.BrowserWindow {
        constructor(original_config) {
            super({
                ...original_config,
                backgroundColor: "#00000000",
                transparent: true
            });
        }
    }

    return {
        ...loaded_module,
        BrowserWindow: HookedBrowserWindow
    }
}


// 使用xprop命令设置毛玻璃背景
function setBackgroundBlur(window_id, plugin) {
    // 命令太长，我就给分开了
    const parms = {
        f: "-f _KDE_NET_WM_BLUR_BEHIND_REGION 32c",
        set: "-set _KDE_NET_WM_BLUR_BEHIND_REGION 0x0"
    }
    const set_blur_command = `xprop -id ${window_id} ${parms.f} ${parms.set}`;
    exec(set_blur_command, (err, stdout, stderr) => {
        if (err) {
            console.log(plugin.manifest.slug, "命令运行失败", err);
            return;
        }
        console.log(plugin.manifest.slug, "命令运行成功", stdout || stderr);
    });
}


// 创建窗口时触发
function onBrowserWindowCreated(window, plugin) {
    window.once("show", () => {
        // 设置窗口也会设置纯黑，所以需要改透明
        window.setBackgroundColor("#00000000");
        // 给每个新开的窗口后面都加上QQ
        // 因为我发现有些窗口不带QQ这俩字符
        // 比如设置窗口就叫设置，导致获取不到窗口ID（
        const window_title = window.getTitle();
        if (!window_title.includes("QQ")) {
            window.setTitle(`${window_title}QQ`);
        }
        // 获取QQ窗口ID
        const get_window_id_command = `wmctrl -l | grep "QQ"`;
        exec(get_window_id_command, (err, stdout, stderr) => {
            if (err) {
                console.log(plugin.manifest.slug, "命令运行失败", err);
                return;
            }
            // 如果有多个窗口，先每行分开
            const lines = stdout.trim().split("\n");
            for (const line of lines) {
                // 按空格分开，第一个就是窗口id
                const window_id = line.split(" ")[0];
                setBackgroundBlur(window_id, plugin);
            }
        });
    });
}


module.exports = {
    onBrowserWindowCreated
}