package com.audiobookshelf.app.plugins

import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * Runs a command in Termux via its RUN_COMMAND service, e.g. `pl start` for Pocket Librarian.
 * Termux must have allow-external-apps = true in ~/.termux/termux.properties.
 */
@CapacitorPlugin(
  name = "TermuxRunner",
  permissions = [Permission(alias = "runCommand", strings = ["com.termux.permission.RUN_COMMAND"])]
)
class TermuxRunner : Plugin() {
  private val tag = "TermuxRunner"

  companion object {
    const val TERMUX_PACKAGE = "com.termux"
    const val RUN_COMMAND_PERMISSION = "com.termux.permission.RUN_COMMAND"
  }

  @PluginMethod
  fun isInstalled(call: PluginCall) {
    val installed = try {
      context.packageManager.getPackageInfo(TERMUX_PACKAGE, 0)
      true
    } catch (e: PackageManager.NameNotFoundException) {
      false
    }
    val ret = JSObject()
    ret.put("installed", installed)
    call.resolve(ret)
  }

  @PluginMethod
  fun run(call: PluginCall) {
    if (getPermissionState("runCommand") != PermissionState.GRANTED) {
      requestPermissionForAlias("runCommand", call, "runCommandPermsCallback")
      return
    }
    doRun(call)
  }

  @PermissionCallback
  private fun runCommandPermsCallback(call: PluginCall) {
    if (getPermissionState("runCommand") == PermissionState.GRANTED) {
      doRun(call)
    } else {
      call.reject("Allow this app to run commands in Termux to start Pocket Librarian from here.")
    }
  }

  private fun doRun(call: PluginCall) {
    val path = call.getString("path") ?: return call.reject("No command path")
    val args = try {
      call.getArray("arguments")?.toList<String>() ?: emptyList()
    } catch (e: Exception) {
      emptyList<String>()
    }
    val intent = Intent().apply {
      setClassName(TERMUX_PACKAGE, "com.termux.app.RunCommandService")
      action = "com.termux.RUN_COMMAND"
      putExtra("com.termux.RUN_COMMAND_PATH", path)
      putExtra("com.termux.RUN_COMMAND_ARGUMENTS", args.toTypedArray())
      putExtra("com.termux.RUN_COMMAND_WORKDIR", call.getString("workdir") ?: "/data/data/com.termux/files/home")
      putExtra("com.termux.RUN_COMMAND_BACKGROUND", call.getBoolean("background", true) ?: true)
    }
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
      call.resolve()
    } catch (e: Exception) {
      Log.e(tag, "Failed to run Termux command", e)
      call.reject("Termux refused the command (${e.message}). In Termux, set allow-external-apps = true in ~/.termux/termux.properties.")
    }
  }
}
