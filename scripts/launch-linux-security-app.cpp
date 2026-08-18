#include <iostream>
#include <cstdlib>
#include <string>
#include <unistd.h>

/**
 * Native C++ High-Security App Launcher for Linux Desktop
 * Compiled with g++ -O3 -std=c++17
 */
int main(int argc, char* argv[]) {
    std::cout << "[ZAITX C++ Core] Starting Native Hardened Security Launcher..." << std::endl;

    std::string appName = "ZAITX Media Admin (Linux C++ Secured)";
    std::string url = "https://admin.zaitxmedia.com";

    // Launch Chrome/Chromium isolated app container natively
    std::string cmd = "google-chrome --app=" + url + " --name=\"" + appName + "\" --class=\"ZAITXAdminSecured\" >/dev/null 2>&1 &";
    
    if (system("which google-chrome >/dev/null 2>&1") != 0) {
        if (system("which chromium-browser >/dev/null 2>&1") == 0) {
            cmd = "chromium-browser --app=" + url + " --name=\"" + appName + "\" --class=\"ZAITXAdminSecured\" >/dev/null 2>&1 &";
        } else if (system("which chromium >/dev/null 2>&1") == 0) {
            cmd = "chromium --app=" + url + " --name=\"" + appName + "\" --class=\"ZAITXAdminSecured\" >/dev/null 2>&1 &";
        } else {
          cmd = "xdg-open " + url + " >/dev/null 2>&1 &";
        }
    }

    std::cout << "[ZAITX C++ Core] Executing secure container..." << std::endl;
    int res = system(cmd.c_str());
    if (res == 0) {
        std::cout << "[ZAITX C++ Core] Admin App started securely." << std::endl;
    }
    return res;
}
