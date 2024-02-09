// 运行在 Electron 主进程 下的插件入口
const { exec, execSync } = require("child_process");
const { Module } = require("module");

// Proxy BrowserWindow，设置窗口透明
const original_load = Module._load;
Module._load = (...args) => {
    const loaded_module = original_load(...args);

    if (args[0] != "electron") {
        return loaded_module;
    }

    let HookedBrowserWindow = new Proxy(loaded_module.BrowserWindow, {
        construct(target, [original_config], newTarget) {
            return Reflect.construct(
                target,
                [
                    {
                        ...original_config,
                        backgroundColor: "#00000000",
                        transparent: true,
                    },
                ],
                newTarget
            );
        },
    });

    return new Proxy(loaded_module, {
        get(target, property, receiver) {
            if (property === "BrowserWindow") {
                return HookedBrowserWindow;
            }
            return Reflect.get(target, property, receiver);
        },
    });
};

// 使用xprop命令设置毛玻璃背景
function setBackgroundBlur(window_id) {
    // 命令太长，我就给分开了
    const parms = {
        id: `-id ${window_id}`,
        f: "-f _KDE_NET_WM_BLUR_BEHIND_REGION 32c",
        set: "-set _KDE_NET_WM_BLUR_BEHIND_REGION 0x0",
    };
    const set_blur_command = `xprop ${parms.id} ${parms.f} ${parms.set}`;
    exec(set_blur_command);
}

// 获取QQ窗口ID
function getWindowIdArray() {
    const window_ids = [];

    try {
        // 执行命令获取QQ的窗口
        const shell_command = `wmctrl -l | grep "QQ"`;
        const stdout = execSync(shell_command, { encoding: "utf-8" });
        // 如果有多个窗口，先每行分开
        const lines = stdout.trim().split("\n");
        for (const line of lines) {
            // 按空格分开，第一个就是窗口id
            const window_id = line.split(" ")[0];
            window_ids.push(window_id);
        }
    } finally {
        return window_ids;
    }
}

// 创建窗口时触发
let prev_ids = [];

function onBrowserWindowCreated(window) {
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

        const interval = setInterval(() => {
            const current_ids = getWindowIdArray();

            // 跟之前获取的数组一样就重新获取
            if (current_ids.toString() == prev_ids.toString()) {
                return;
            }

            // 给新的window id设置背景模糊效果
            for (const id of current_ids) {
                if (!prev_ids.includes(id)) {
                    setBackgroundBlur(id);
                }
            }

            prev_ids = current_ids;
            clearInterval(interval);
        }, 100);
    });
}

module.exports = {
    onBrowserWindowCreated,
};
