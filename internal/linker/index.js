/* THIS FILE GENERATED FROM .ts; see BUILD.bazel */ /* clang-format off */var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("build_bazel_rules_nodejs/internal/linker/link_node_modules", ["require", "exports", "fs", "path"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    /**
     * @fileoverview Creates a node_modules directory in the current working directory
     * and symlinks in the node modules needed to run a program.
     * This replaces the need for custom module resolution logic inside the process.
     */
    const fs = require("fs");
    const path = require("path");
    // Run Bazel with --define=VERBOSE_LOGS=1 to enable this logging
    const VERBOSE_LOGS = !!process.env['VERBOSE_LOGS'];
    function log_verbose(...m) {
        if (VERBOSE_LOGS)
            console.error('[link_node_modules.js]', ...m);
    }
    function panic(m) {
        throw new Error(`Internal error! Please run again with
   --define=VERBOSE_LOG=1
and file an issue: https://github.com/bazelbuild/rules_nodejs/issues/new?template=bug_report.md
Include as much of the build output as you can without disclosing anything confidential.

  Error:
  ${m}
  `);
    }
    function symlink(target, path) {
        return __awaiter(this, void 0, void 0, function* () {
            log_verbose(`symlink( ${path} -> ${target} )`);
            // Use junction on Windows since symlinks require elevated permissions.
            // We only link to directories so junctions work for us.
            try {
                yield fs.promises.symlink(target, path, 'junction');
            }
            catch (e) {
                if (e.code !== 'EEXIST') {
                    throw e;
                }
                // We assume here that the path is already linked to the correct target.
                // Could add some logic that asserts it here, but we want to avoid an extra
                // filesystem access so we should only do it under some kind of strict mode.
            }
            if (VERBOSE_LOGS) {
                // Be verbose about creating a bad symlink
                // Maybe this should fail in production as well, but again we want to avoid
                // any unneeded file I/O
                if (!fs.existsSync(path)) {
                    log_verbose('ERROR\n***\nLooks like we created a bad symlink:' +
                        `\n  pwd ${process.cwd()}\n  target ${target}\n***`);
                }
            }
        });
    }
    /**
     * Resolve a root directory string to the actual location on disk
     * where node_modules was installed
     * @param root a string like 'npm/node_modules'
     */
    function resolveRoot(root, runfiles) {
        // create a node_modules directory if no root
        // this will be the case if only first-party modules are installed
        if (!root) {
            if (!fs.existsSync('node_modules')) {
                log_verbose('no third-party packages; mkdir node_modules in ', process.cwd());
                fs.mkdirSync('node_modules');
            }
            return 'node_modules';
        }
        // If we got a runfilesManifest map, look through it for a resolution
        // This will happen if we are running a binary that had some npm packages
        // "statically linked" into its runfiles
        const fromManifest = runfiles.lookupDirectory(root);
        if (fromManifest)
            return fromManifest;
        // Account for Bazel --legacy_external_runfiles
        // which look like 'my_wksp/external/npm/node_modules'
        if (fs.existsSync(path.join('external', root))) {
            log_verbose('Found legacy_external_runfiles, switching root to', path.join('external', root));
            return path.join('external', root);
        }
        // The repository should be layed out in the parent directory
        // since bazel sets our working directory to the repository where the build is happening
        return path.join('..', root);
    }
    class Runfiles {
        constructor() {
            // If Bazel sets a variable pointing to a runfiles manifest,
            // we'll always use it.
            // Note that this has a slight performance implication on Mac/Linux
            // where we could use the runfiles tree already laid out on disk
            // but this just costs one file read for the external npm/node_modules
            // and one for each first-party module, not one per file.
            if (!!process.env['RUNFILES_MANIFEST_FILE']) {
                this.manifest = this.loadRunfilesManifest(process.env['RUNFILES_MANIFEST_FILE']);
            }
            else if (!!process.env['RUNFILES_DIR']) {
                this.dir = path.resolve(process.env['RUNFILES_DIR']);
            }
            else {
                panic('Every node program run under Bazel must have a $RUNFILES_DIR or $RUNFILES_MANIFEST_FILE environment variable');
            }
            // Under --noenable_runfiles (in particular on Windows)
            // Bazel sets RUNFILES_MANIFEST_ONLY=1.
            // When this happens, we need to read the manifest file to locate
            // inputs
            if (process.env['RUNFILES_MANIFEST_ONLY'] === '1' && !process.env['RUNFILES_MANIFEST_FILE']) {
                log_verbose(`Workaround https://github.com/bazelbuild/bazel/issues/7994
                 RUNFILES_MANIFEST_FILE should have been set but wasn't.
                 falling back to using runfiles symlinks.
                 If you want to test runfiles manifest behavior, add
                 --spawn_strategy=standalone to the command line.`);
            }
        }
        lookupDirectory(dir) {
            if (!this.manifest)
                return undefined;
            for (const [k, v] of this.manifest) {
                // Entry looks like
                // k: npm/node_modules/semver/LICENSE
                // v: /path/to/external/npm/node_modules/semver/LICENSE
                // calculate l = length(`/semver/LICENSE`)
                if (k.startsWith(dir)) {
                    const l = k.length - dir.length;
                    return v.substring(0, v.length - l);
                }
            }
        }
        /**
         * The runfiles manifest maps from short_path
         * https://docs.bazel.build/versions/master/skylark/lib/File.html#short_path
         * to the actual location on disk where the file can be read.
         *
         * In a sandboxed execution, it does not exist. In that case, runfiles must be
         * resolved from a symlink tree under the runfiles dir.
         * See https://github.com/bazelbuild/bazel/issues/3726
         */
        loadRunfilesManifest(manifestPath) {
            log_verbose(`using runfiles manifest ${manifestPath}`);
            const runfilesEntries = new Map();
            const input = fs.readFileSync(manifestPath, { encoding: 'utf-8' });
            for (const line of input.split('\n')) {
                if (!line)
                    continue;
                const [runfilesPath, realPath] = line.split(' ');
                runfilesEntries.set(runfilesPath, realPath);
            }
            return runfilesEntries;
        }
    }
    exports.Runfiles = Runfiles;
    // There is no fs.promises.exists function because
    // node core is of the opinion that exists is always too racey to rely on.
    function exists(p) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield fs.promises.stat(p);
                return true;
            }
            catch (e) {
                if (e.code === 'ENOENT') {
                    return false;
                }
                throw e;
            }
        });
    }
    function main(args, runfiles) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!args || args.length < 1)
                throw new Error('link_node_modules.js requires one argument: modulesManifest path');
            const [modulesManifest] = args;
            let { bin, root, modules, workspace } = JSON.parse(fs.readFileSync(modulesManifest));
            modules = modules || {};
            log_verbose(`module manifest: workspace ${workspace}, bin ${bin}, root ${root} with first-party packages\n`, modules);
            const rootDir = resolveRoot(root, runfiles);
            log_verbose('resolved root', root, 'to', rootDir);
            // Bazel starts actions with pwd=execroot/my_wksp
            const workspaceDir = path.resolve('.');
            // Convert from runfiles path
            // this_wksp/path/to/file OR other_wksp/path/to/file
            // to execroot path
            // path/to/file OR external/other_wksp/path/to/file
            function toWorkspaceDir(p) {
                if (p.startsWith(workspace + path.sep)) {
                    return p.substring(workspace.length + 1);
                }
                return path.join('external', p);
            }
            // Create the $pwd/node_modules directory that node will resolve from
            yield symlink(rootDir, 'node_modules');
            process.chdir(rootDir);
            // Symlinks to packages need to reach back to the workspace/runfiles directory
            const workspaceRelative = path.relative('.', workspaceDir);
            const runfilesRelative = runfiles.dir ? path.relative('.', runfiles.dir) : undefined;
            // Now add symlinks to each of our first-party packages so they appear under the node_modules tree
            const links = [];
            const linkModule = (name, modulePath) => __awaiter(this, void 0, void 0, function* () {
                let target;
                // Look in the runfiles first
                // TODO: this could be a method in the Runfiles class
                if (runfiles.manifest) {
                    target = runfiles.lookupDirectory(modulePath);
                }
                else if (runfilesRelative) {
                    target = path.join(runfilesRelative, modulePath);
                }
                // It sucks that we have to do a FS call here.
                // TODO: could we know which packages are statically linked??
                if (!target || !(yield exists(target))) {
                    // Try the bin dir
                    target = path.join(workspaceRelative, bin, toWorkspaceDir(modulePath));
                    if (!(yield exists(target))) {
                        // Try the execroot
                        target = path.join(workspaceRelative, toWorkspaceDir(modulePath));
                    }
                }
                yield symlink(target, name);
            });
            for (const m of Object.keys(modules)) {
                links.push(linkModule(m, modules[m]));
            }
            yield Promise.all(links);
            return 0;
        });
    }
    exports.main = main;
    if (require.main === module) {
        (() => __awaiter(this, void 0, void 0, function* () {
            process.exitCode = yield main(process.argv.slice(2), new Runfiles());
        }))();
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlua19ub2RlX21vZHVsZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9pbnRlcm5hbC9saW5rZXIvbGlua19ub2RlX21vZHVsZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUFBOzs7O09BSUc7SUFDSCx5QkFBeUI7SUFDekIsNkJBQTZCO0lBRTdCLGdFQUFnRTtJQUNoRSxNQUFNLFlBQVksR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUVuRCxTQUFTLFdBQVcsQ0FBQyxHQUFHLENBQVc7UUFDakMsSUFBSSxZQUFZO1lBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyx3QkFBd0IsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ2xFLENBQUM7SUFFRCxTQUFTLEtBQUssQ0FBQyxDQUFTO1FBQ3RCLE1BQU0sSUFBSSxLQUFLLENBQUM7Ozs7OztJQU1kLENBQUM7R0FDRixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsU0FBZSxPQUFPLENBQUMsTUFBYyxFQUFFLElBQVk7O1lBQ2pELFdBQVcsQ0FBQyxZQUFZLElBQUksT0FBTyxNQUFNLElBQUksQ0FBQyxDQUFDO1lBQy9DLHVFQUF1RTtZQUN2RSx3REFBd0Q7WUFDeEQsSUFBSTtnQkFDRixNQUFNLEVBQUUsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUM7YUFDckQ7WUFBQyxPQUFPLENBQUMsRUFBRTtnQkFDVixJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFO29CQUN2QixNQUFNLENBQUMsQ0FBQztpQkFDVDtnQkFDRCx3RUFBd0U7Z0JBQ3hFLDJFQUEyRTtnQkFDM0UsNEVBQTRFO2FBQzdFO1lBRUQsSUFBSSxZQUFZLEVBQUU7Z0JBQ2hCLDBDQUEwQztnQkFDMUMsMkVBQTJFO2dCQUMzRSx3QkFBd0I7Z0JBQ3hC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d0JBQ3pCLG1CQUFtQjt3QkFDbkIsTUFBTSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsY0FBYyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7cUJBQ25FO2lCQUNGO2dCQUVELE1BQU0sT0FBTyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztZQUM5QixDQUFDLENBQUEsQ0FBQTtZQUVELEtBQUssTUFBTSxDQUFDLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRTtnQkFDcEMsS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDdkM7WUFFRCxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7WUFFekIsT0FBTyxDQUFDLENBQUM7UUFDWCxDQUFDO0tBQUE7SUF6RUQsb0JBeUVDO0lBRUQsSUFBSSxPQUFPLENBQUMsSUFBSSxLQUFLLE1BQU0sRUFBRTtRQUMzQixDQUFDLEdBQVMsRUFBRTtZQUNWLE9BQU8sQ0FBQyxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZFLENBQUMsQ0FBQSxDQUFDLEVBQUUsQ0FBQztLQUNOIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAZmlsZW92ZXJ2aWV3IENyZWF0ZXMgYSBub2RlX21vZHVsZXMgZGlyZWN0b3J5IGluIHRoZSBjdXJyZW50IHdvcmtpbmcgZGlyZWN0b3J5XG4gKiBhbmQgc3ltbGlua3MgaW4gdGhlIG5vZGUgbW9kdWxlcyBuZWVkZWQgdG8gcnVuIGEgcHJvZ3JhbS5cbiAqIFRoaXMgcmVwbGFjZXMgdGhlIG5lZWQgZm9yIGN1c3RvbSBtb2R1bGUgcmVzb2x1dGlvbiBsb2dpYyBpbnNpZGUgdGhlIHByb2Nlc3MuXG4gKi9cbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbi8vIFJ1biBCYXplbCB3aXRoIC0tZGVmaW5lPVZFUkJPU0VfTE9HUz0xIHRvIGVuYWJsZSB0aGlzIGxvZ2dpbmdcbmNvbnN0IFZFUkJPU0VfTE9HUyA9ICEhcHJvY2Vzcy5lbnZbJ1ZFUkJPU0VfTE9HUyddO1xuXG5mdW5jdGlvbiBsb2dfdmVyYm9zZSguLi5tOiBzdHJpbmdbXSkge1xuICBpZiAoVkVSQk9TRV9MT0dTKSBjb25zb2xlLmVycm9yKCdbbGlua19ub2RlX21vZHVsZXMuanNdJywgLi4ubSk7XG59XG5cbmZ1bmN0aW9uIHBhbmljKG06IHN0cmluZykge1xuICB0aHJvdyBuZXcgRXJyb3IoYEludGVybmFsIGVycm9yISBQbGVhc2UgcnVuIGFnYWluIHdpdGhcbiAgIC0tZGVmaW5lPVZFUkJPU0VfTE9HPTFcbmFuZCBmaWxlIGFuIGlzc3VlOiBodHRwczovL2dpdGh1Yi5jb20vYmF6ZWxidWlsZC9ydWxlc19ub2RlanMvaXNzdWVzL25ldz90ZW1wbGF0ZT1idWdfcmVwb3J0Lm1kXG5JbmNsdWRlIGFzIG11Y2ggb2YgdGhlIGJ1aWxkIG91dHB1dCBhcyB5b3UgY2FuIHdpdGhvdXQgZGlzY2xvc2luZyBhbnl0aGluZyBjb25maWRlbnRpYWwuXG5cbiAgRXJyb3I6XG4gICR7bX1cbiAgYCk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHN5bWxpbmsodGFyZ2V0OiBzdHJpbmcsIHBhdGg6IHN0cmluZykge1xuICBsb2dfdmVyYm9zZShgc3ltbGluayggJHtwYXRofSAtPiAke3RhcmdldH0gKWApO1xuICAvLyBVc2UganVuY3Rpb24gb24gV2luZG93cyBzaW5jZSBzeW1saW5rcyByZXF1aXJlIGVsZXZhdGVkIHBlcm1pc3Npb25zLlxuICAvLyBXZSBvbmx5IGxpbmsgdG8gZGlyZWN0b3JpZXMgc28ganVuY3Rpb25zIHdvcmsgZm9yIHVzLlxuICB0cnkge1xuICAgIGF3YWl0IGZzLnByb21pc2VzLnN5bWxpbmsodGFyZ2V0LCBwYXRoLCAnanVuY3Rpb24nKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGlmIChlLmNvZGUgIT09ICdFRVhJU1QnKSB7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgICAvLyBXZSBhc3N1bWUgaGVyZSB0aGF0IHRoZSBwYXRoIGlzIGFscmVhZHkgbGlua2VkIHRvIHRoZSBjb3JyZWN0IHRhcmdldC5cbiAgICAvLyBDb3VsZCBhZGQgc29tZSBsb2dpYyB0aGF0IGFzc2VydHMgaXQgaGVyZSwgYnV0IHdlIHdhbnQgdG8gYXZvaWQgYW4gZXh0cmFcbiAgICAvLyBmaWxlc3lzdGVtIGFjY2VzcyBzbyB3ZSBzaG91bGQgb25seSBkbyBpdCB1bmRlciBzb21lIGtpbmQgb2Ygc3RyaWN0IG1vZGUuXG4gIH1cblxuICBpZiAoVkVSQk9TRV9MT0dTKSB7XG4gICAgLy8gQmUgdmVyYm9zZSBhYm91dCBjcmVhdGluZyBhIGJhZCBzeW1saW5rXG4gICAgLy8gTWF5YmUgdGhpcyBzaG91bGQgZmFpbCBpbiBwcm9kdWN0aW9uIGFzIHdlbGwsIGJ1dCBhZ2FpbiB3ZSB3YW50IHRvIGF2b2lkXG4gICAgLy8gYW55IHVubmVlZGVkIGZpbGUgSS9PXG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKHBhdGgpKSB7XG4gICAgICBsb2dfdmVyYm9zZShcbiAgICAgICAgICAnRVJST1JcXG4qKipcXG5Mb29rcyBsaWtlIHdlIGNyZWF0ZWQgYSBiYWQgc3ltbGluazonICtcbiAgICAgICAgICBgXFxuICBwd2QgJHtwcm9jZXNzLmN3ZCgpfVxcbiAgdGFyZ2V0ICR7dGFyZ2V0fVxcbioqKmApO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFJlc29sdmUgYSByb290IGRpcmVjdG9yeSBzdHJpbmcgdG8gdGhlIGFjdHVhbCBsb2NhdGlvbiBvbiBkaXNrXG4gKiB3aGVyZSBub2RlX21vZHVsZXMgd2FzIGluc3RhbGxlZFxuICogQHBhcmFtIHJvb3QgYSBzdHJpbmcgbGlrZSAnbnBtL25vZGVfbW9kdWxlcydcbiAqL1xuZnVuY3Rpb24gcmVzb2x2ZVJvb3Qocm9vdDogc3RyaW5nfHVuZGVmaW5lZCwgcnVuZmlsZXM6IFJ1bmZpbGVzKSB7XG4gIC8vIGNyZWF0ZSBhIG5vZGVfbW9kdWxlcyBkaXJlY3RvcnkgaWYgbm8gcm9vdFxuICAvLyB0aGlzIHdpbGwgYmUgdGhlIGNhc2UgaWYgb25seSBmaXJzdC1wYXJ0eSBtb2R1bGVzIGFyZSBpbnN0YWxsZWRcbiAgaWYgKCFyb290KSB7XG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKCdub2RlX21vZHVsZXMnKSkge1xuICAgICAgbG9nX3ZlcmJvc2UoJ25vIHRoaXJkLXBhcnR5IHBhY2thZ2VzOyBta2RpciBub2RlX21vZHVsZXMgaW4gJywgcHJvY2Vzcy5jd2QoKSk7XG4gICAgICBmcy5ta2RpclN5bmMoJ25vZGVfbW9kdWxlcycpO1xuICAgIH1cbiAgICByZXR1cm4gJ25vZGVfbW9kdWxlcyc7XG4gIH1cblxuICAvLyBJZiB3ZSBnb3QgYSBydW5maWxlc01hbmlmZXN0IG1hcCwgbG9vayB0aHJvdWdoIGl0IGZvciBhIHJlc29sdXRpb25cbiAgLy8gVGhpcyB3aWxsIGhhcHBlbiBpZiB3ZSBhcmUgcnVubmluZyBhIGJpbmFyeSB0aGF0IGhhZCBzb21lIG5wbSBwYWNrYWdlc1xuICAvLyBcInN0YXRpY2FsbHkgbGlua2VkXCIgaW50byBpdHMgcnVuZmlsZXNcbiAgY29uc3QgZnJvbU1hbmlmZXN0ID0gcnVuZmlsZXMubG9va3VwRGlyZWN0b3J5KHJvb3QpO1xuICBpZiAoZnJvbU1hbmlmZXN0KSByZXR1cm4gZnJvbU1hbmlmZXN0O1xuXG4gIC8vIEFjY291bnQgZm9yIEJhemVsIC0tbGVnYWN5X2V4dGVybmFsX3J1bmZpbGVzXG4gIC8vIHdoaWNoIGxvb2sgbGlrZSAnbXlfd2tzcC9leHRlcm5hbC9ucG0vbm9kZV9tb2R1bGVzJ1xuICBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4oJ2V4dGVybmFsJywgcm9vdCkpKSB7XG4gICAgbG9nX3ZlcmJvc2UoJ0ZvdW5kIGxlZ2FjeV9leHRlcm5hbF9ydW5maWxlcywgc3dpdGNoaW5nIHJvb3QgdG8nLCBwYXRoLmpvaW4oJ2V4dGVybmFsJywgcm9vdCkpO1xuICAgIHJldHVybiBwYXRoLmpvaW4oJ2V4dGVybmFsJywgcm9vdCk7XG4gIH1cblxuICAvLyBUaGUgcmVwb3NpdG9yeSBzaG91bGQgYmUgbGF5ZWQgb3V0IGluIHRoZSBwYXJlbnQgZGlyZWN0b3J5XG4gIC8vIHNpbmNlIGJhemVsIHNldHMgb3VyIHdvcmtpbmcgZGlyZWN0b3J5IHRvIHRoZSByZXBvc2l0b3J5IHdoZXJlIHRoZSBidWlsZCBpcyBoYXBwZW5pbmdcbiAgcmV0dXJuIHBhdGguam9pbignLi4nLCByb290KTtcbn1cblxuZXhwb3J0IGNsYXNzIFJ1bmZpbGVzIHtcbiAgbWFuaWZlc3Q6IE1hcDxzdHJpbmcsIHN0cmluZz58dW5kZWZpbmVkO1xuICBkaXI6IHN0cmluZ3x1bmRlZmluZWQ7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgLy8gSWYgQmF6ZWwgc2V0cyBhIHZhcmlhYmxlIHBvaW50aW5nIHRvIGEgcnVuZmlsZXMgbWFuaWZlc3QsXG4gICAgLy8gd2UnbGwgYWx3YXlzIHVzZSBpdC5cbiAgICAvLyBOb3RlIHRoYXQgdGhpcyBoYXMgYSBzbGlnaHQgcGVyZm9ybWFuY2UgaW1wbGljYXRpb24gb24gTWFjL0xpbnV4XG4gICAgLy8gd2hlcmUgd2UgY291bGQgdXNlIHRoZSBydW5maWxlcyB0cmVlIGFscmVhZHkgbGFpZCBvdXQgb24gZGlza1xuICAgIC8vIGJ1dCB0aGlzIGp1c3QgY29zdHMgb25lIGZpbGUgcmVhZCBmb3IgdGhlIGV4dGVybmFsIG5wbS9ub2RlX21vZHVsZXNcbiAgICAvLyBhbmQgb25lIGZvciBlYWNoIGZpcnN0LXBhcnR5IG1vZHVsZSwgbm90IG9uZSBwZXIgZmlsZS5cbiAgICBpZiAoISFwcm9jZXNzLmVudlsnUlVORklMRVNfTUFOSUZFU1RfRklMRSddKSB7XG4gICAgICB0aGlzLm1hbmlmZXN0ID0gdGhpcy5sb2FkUnVuZmlsZXNNYW5pZmVzdChwcm9jZXNzLmVudlsnUlVORklMRVNfTUFOSUZFU1RfRklMRSddISk7XG4gICAgfSBlbHNlIGlmICghIXByb2Nlc3MuZW52WydSVU5GSUxFU19ESVInXSkge1xuICAgICAgdGhpcy5kaXIgPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5lbnZbJ1JVTkZJTEVTX0RJUiddISk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBhbmljKFxuICAgICAgICAgICdFdmVyeSBub2RlIHByb2dyYW0gcnVuIHVuZGVyIEJhemVsIG11c3QgaGF2ZSBhICRSVU5GSUxFU19ESVIgb3IgJFJVTkZJTEVTX01BTklGRVNUX0ZJTEUgZW52aXJvbm1lbnQgdmFyaWFibGUnKTtcbiAgICB9XG4gICAgLy8gVW5kZXIgLS1ub2VuYWJsZV9ydW5maWxlcyAoaW4gcGFydGljdWxhciBvbiBXaW5kb3dzKVxuICAgIC8vIEJhemVsIHNldHMgUlVORklMRVNfTUFOSUZFU1RfT05MWT0xLlxuICAgIC8vIFdoZW4gdGhpcyBoYXBwZW5zLCB3ZSBuZWVkIHRvIHJlYWQgdGhlIG1hbmlmZXN0IGZpbGUgdG8gbG9jYXRlXG4gICAgLy8gaW5wdXRzXG4gICAgaWYgKHByb2Nlc3MuZW52WydSVU5GSUxFU19NQU5JRkVTVF9PTkxZJ10gPT09ICcxJyAmJiAhcHJvY2Vzcy5lbnZbJ1JVTkZJTEVTX01BTklGRVNUX0ZJTEUnXSkge1xuICAgICAgbG9nX3ZlcmJvc2UoYFdvcmthcm91bmQgaHR0cHM6Ly9naXRodWIuY29tL2JhemVsYnVpbGQvYmF6ZWwvaXNzdWVzLzc5OTRcbiAgICAgICAgICAgICAgICAgUlVORklMRVNfTUFOSUZFU1RfRklMRSBzaG91bGQgaGF2ZSBiZWVuIHNldCBidXQgd2Fzbid0LlxuICAgICAgICAgICAgICAgICBmYWxsaW5nIGJhY2sgdG8gdXNpbmcgcnVuZmlsZXMgc3ltbGlua3MuXG4gICAgICAgICAgICAgICAgIElmIHlvdSB3YW50IHRvIHRlc3QgcnVuZmlsZXMgbWFuaWZlc3QgYmVoYXZpb3IsIGFkZFxuICAgICAgICAgICAgICAgICAtLXNwYXduX3N0cmF0ZWd5PXN0YW5kYWxvbmUgdG8gdGhlIGNvbW1hbmQgbGluZS5gKTtcbiAgICB9XG4gIH1cblxuICBsb29rdXBEaXJlY3RvcnkoZGlyOiBzdHJpbmcpOiBzdHJpbmd8dW5kZWZpbmVkIHtcbiAgICBpZiAoIXRoaXMubWFuaWZlc3QpIHJldHVybiB1bmRlZmluZWQ7XG5cbiAgICBmb3IgKGNvbnN0IFtrLCB2XSBvZiB0aGlzLm1hbmlmZXN0KSB7XG4gICAgICAvLyBFbnRyeSBsb29rcyBsaWtlXG4gICAgICAvLyBrOiBucG0vbm9kZV9tb2R1bGVzL3NlbXZlci9MSUNFTlNFXG4gICAgICAvLyB2OiAvcGF0aC90by9leHRlcm5hbC9ucG0vbm9kZV9tb2R1bGVzL3NlbXZlci9MSUNFTlNFXG4gICAgICAvLyBjYWxjdWxhdGUgbCA9IGxlbmd0aChgL3NlbXZlci9MSUNFTlNFYClcbiAgICAgIGlmIChrLnN0YXJ0c1dpdGgoZGlyKSkge1xuICAgICAgICBjb25zdCBsID0gay5sZW5ndGggLSBkaXIubGVuZ3RoO1xuICAgICAgICByZXR1cm4gdi5zdWJzdHJpbmcoMCwgdi5sZW5ndGggLSBsKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuXG4gIC8qKlxuICAgKiBUaGUgcnVuZmlsZXMgbWFuaWZlc3QgbWFwcyBmcm9tIHNob3J0X3BhdGhcbiAgICogaHR0cHM6Ly9kb2NzLmJhemVsLmJ1aWxkL3ZlcnNpb25zL21hc3Rlci9za3lsYXJrL2xpYi9GaWxlLmh0bWwjc2hvcnRfcGF0aFxuICAgKiB0byB0aGUgYWN0dWFsIGxvY2F0aW9uIG9uIGRpc2sgd2hlcmUgdGhlIGZpbGUgY2FuIGJlIHJlYWQuXG4gICAqXG4gICAqIEluIGEgc2FuZGJveGVkIGV4ZWN1dGlvbiwgaXQgZG9lcyBub3QgZXhpc3QuIEluIHRoYXQgY2FzZSwgcnVuZmlsZXMgbXVzdCBiZVxuICAgKiByZXNvbHZlZCBmcm9tIGEgc3ltbGluayB0cmVlIHVuZGVyIHRoZSBydW5maWxlcyBkaXIuXG4gICAqIFNlZSBodHRwczovL2dpdGh1Yi5jb20vYmF6ZWxidWlsZC9iYXplbC9pc3N1ZXMvMzcyNlxuICAgKi9cbiAgbG9hZFJ1bmZpbGVzTWFuaWZlc3QobWFuaWZlc3RQYXRoOiBzdHJpbmcpIHtcbiAgICBsb2dfdmVyYm9zZShgdXNpbmcgcnVuZmlsZXMgbWFuaWZlc3QgJHttYW5pZmVzdFBhdGh9YCk7XG5cbiAgICBjb25zdCBydW5maWxlc0VudHJpZXMgPSBuZXcgTWFwKCk7XG4gICAgY29uc3QgaW5wdXQgPSBmcy5yZWFkRmlsZVN5bmMobWFuaWZlc3RQYXRoLCB7ZW5jb2Rpbmc6ICd1dGYtOCd9KTtcblxuICAgIGZvciAoY29uc3QgbGluZSBvZiBpbnB1dC5zcGxpdCgnXFxuJykpIHtcbiAgICAgIGlmICghbGluZSkgY29udGludWU7XG4gICAgICBjb25zdCBbcnVuZmlsZXNQYXRoLCByZWFsUGF0aF0gPSBsaW5lLnNwbGl0KCcgJyk7XG4gICAgICBydW5maWxlc0VudHJpZXMuc2V0KHJ1bmZpbGVzUGF0aCwgcmVhbFBhdGgpO1xuICAgIH1cblxuICAgIHJldHVybiBydW5maWxlc0VudHJpZXM7XG4gIH1cbn1cblxuLy8gVHlwZVNjcmlwdCBsaWIuZXM1LmQudHMgaGFzIGEgbWlzdGFrZTogSlNPTi5wYXJzZSBkb2VzIGFjY2VwdCBCdWZmZXIuXG5kZWNsYXJlIGdsb2JhbCB7XG4gIGludGVyZmFjZSBKU09OIHtcbiAgICBwYXJzZShiOiB7dG9TdHJpbmc6ICgpID0+IHN0cmluZ30pOiBhbnk7XG4gIH1cbn1cblxuLy8gVGhlcmUgaXMgbm8gZnMucHJvbWlzZXMuZXhpc3RzIGZ1bmN0aW9uIGJlY2F1c2Vcbi8vIG5vZGUgY29yZSBpcyBvZiB0aGUgb3BpbmlvbiB0aGF0IGV4aXN0cyBpcyBhbHdheXMgdG9vIHJhY2V5IHRvIHJlbHkgb24uXG5hc3luYyBmdW5jdGlvbiBleGlzdHMocDogc3RyaW5nKSB7XG4gIHRyeSB7XG4gICAgYXdhaXQgZnMucHJvbWlzZXMuc3RhdChwKVxuICAgIHJldHVybiB0cnVlO1xuICB9IGNhdGNoIChlKSB7XG4gICAgaWYgKGUuY29kZSA9PT0gJ0VOT0VOVCcpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgdGhyb3cgZTtcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbWFpbihhcmdzOiBzdHJpbmdbXSwgcnVuZmlsZXM6IFJ1bmZpbGVzKSB7XG4gIGlmICghYXJncyB8fCBhcmdzLmxlbmd0aCA8IDEpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdsaW5rX25vZGVfbW9kdWxlcy5qcyByZXF1aXJlcyBvbmUgYXJndW1lbnQ6IG1vZHVsZXNNYW5pZmVzdCBwYXRoJyk7XG5cbiAgY29uc3QgW21vZHVsZXNNYW5pZmVzdF0gPSBhcmdzO1xuICBsZXQge2Jpbiwgcm9vdCwgbW9kdWxlcywgd29ya3NwYWNlfSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKG1vZHVsZXNNYW5pZmVzdCkpO1xuICBtb2R1bGVzID0gbW9kdWxlcyB8fCB7fTtcbiAgbG9nX3ZlcmJvc2UoXG4gICAgICBgbW9kdWxlIG1hbmlmZXN0OiB3b3Jrc3BhY2UgJHt3b3Jrc3BhY2V9LCBiaW4gJHtiaW59LCByb290ICR7XG4gICAgICAgICAgcm9vdH0gd2l0aCBmaXJzdC1wYXJ0eSBwYWNrYWdlc1xcbmAsXG4gICAgICBtb2R1bGVzKTtcblxuICBjb25zdCByb290RGlyID0gcmVzb2x2ZVJvb3Qocm9vdCwgcnVuZmlsZXMpO1xuICBsb2dfdmVyYm9zZSgncmVzb2x2ZWQgcm9vdCcsIHJvb3QsICd0bycsIHJvb3REaXIpO1xuXG4gIC8vIEJhemVsIHN0YXJ0cyBhY3Rpb25zIHdpdGggcHdkPWV4ZWNyb290L215X3drc3BcbiAgY29uc3Qgd29ya3NwYWNlRGlyID0gcGF0aC5yZXNvbHZlKCcuJyk7XG5cbiAgLy8gQ29udmVydCBmcm9tIHJ1bmZpbGVzIHBhdGhcbiAgLy8gdGhpc193a3NwL3BhdGgvdG8vZmlsZSBPUiBvdGhlcl93a3NwL3BhdGgvdG8vZmlsZVxuICAvLyB0byBleGVjcm9vdCBwYXRoXG4gIC8vIHBhdGgvdG8vZmlsZSBPUiBleHRlcm5hbC9vdGhlcl93a3NwL3BhdGgvdG8vZmlsZVxuICBmdW5jdGlvbiB0b1dvcmtzcGFjZURpcihwOiBzdHJpbmcpIHtcbiAgICBpZiAocC5zdGFydHNXaXRoKHdvcmtzcGFjZSArIHBhdGguc2VwKSkge1xuICAgICAgcmV0dXJuIHAuc3Vic3RyaW5nKHdvcmtzcGFjZS5sZW5ndGggKyAxKTtcbiAgICB9XG4gICAgcmV0dXJuIHBhdGguam9pbignZXh0ZXJuYWwnLCBwKTtcbiAgfVxuXG4gIC8vIENyZWF0ZSB0aGUgJHB3ZC9ub2RlX21vZHVsZXMgZGlyZWN0b3J5IHRoYXQgbm9kZSB3aWxsIHJlc29sdmUgZnJvbVxuICBhd2FpdCBzeW1saW5rKHJvb3REaXIsICdub2RlX21vZHVsZXMnKTtcbiAgcHJvY2Vzcy5jaGRpcihyb290RGlyKTtcblxuICAvLyBTeW1saW5rcyB0byBwYWNrYWdlcyBuZWVkIHRvIHJlYWNoIGJhY2sgdG8gdGhlIHdvcmtzcGFjZS9ydW5maWxlcyBkaXJlY3RvcnlcbiAgY29uc3Qgd29ya3NwYWNlUmVsYXRpdmUgPSBwYXRoLnJlbGF0aXZlKCcuJywgd29ya3NwYWNlRGlyKTtcbiAgY29uc3QgcnVuZmlsZXNSZWxhdGl2ZSA9IHJ1bmZpbGVzLmRpciA/IHBhdGgucmVsYXRpdmUoJy4nLCBydW5maWxlcy5kaXIpIDogdW5kZWZpbmVkO1xuXG4gIC8vIE5vdyBhZGQgc3ltbGlua3MgdG8gZWFjaCBvZiBvdXIgZmlyc3QtcGFydHkgcGFja2FnZXMgc28gdGhleSBhcHBlYXIgdW5kZXIgdGhlIG5vZGVfbW9kdWxlcyB0cmVlXG4gIGNvbnN0IGxpbmtzID0gW107XG5cbiAgY29uc3QgbGlua01vZHVsZSA9XG4gICAgICBhc3luYyAobmFtZTogc3RyaW5nLCBtb2R1bGVQYXRoOiBzdHJpbmcpID0+IHtcbiAgICBsZXQgdGFyZ2V0OiBzdHJpbmd8dW5kZWZpbmVkO1xuXG4gICAgLy8gTG9vayBpbiB0aGUgcnVuZmlsZXMgZmlyc3RcbiAgICAvLyBUT0RPOiB0aGlzIGNvdWxkIGJlIGEgbWV0aG9kIGluIHRoZSBSdW5maWxlcyBjbGFzc1xuICAgIGlmIChydW5maWxlcy5tYW5pZmVzdCkge1xuICAgICAgdGFyZ2V0ID0gcnVuZmlsZXMubG9va3VwRGlyZWN0b3J5KG1vZHVsZVBhdGgpO1xuICAgIH0gZWxzZSBpZiAocnVuZmlsZXNSZWxhdGl2ZSkge1xuICAgICAgdGFyZ2V0ID0gcGF0aC5qb2luKHJ1bmZpbGVzUmVsYXRpdmUsIG1vZHVsZVBhdGgpO1xuICAgIH1cblxuICAgIC8vIEl0IHN1Y2tzIHRoYXQgd2UgaGF2ZSB0byBkbyBhIEZTIGNhbGwgaGVyZS5cbiAgICAvLyBUT0RPOiBjb3VsZCB3ZSBrbm93IHdoaWNoIHBhY2thZ2VzIGFyZSBzdGF0aWNhbGx5IGxpbmtlZD8/XG4gICAgaWYgKCF0YXJnZXQgfHwgIWF3YWl0IGV4aXN0cyh0YXJnZXQpKSB7XG4gICAgICAvLyBUcnkgdGhlIGJpbiBkaXJcbiAgICAgIHRhcmdldCA9IHBhdGguam9pbih3b3Jrc3BhY2VSZWxhdGl2ZSwgYmluLCB0b1dvcmtzcGFjZURpcihtb2R1bGVQYXRoKSk7XG4gICAgICBpZiAoIWF3YWl0IGV4aXN0cyh0YXJnZXQpKSB7XG4gICAgICAgIC8vIFRyeSB0aGUgZXhlY3Jvb3RcbiAgICAgICAgdGFyZ2V0ID0gcGF0aC5qb2luKHdvcmtzcGFjZVJlbGF0aXZlLCB0b1dvcmtzcGFjZURpcihtb2R1bGVQYXRoKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgYXdhaXQgc3ltbGluayh0YXJnZXQsIG5hbWUpO1xuICB9XG5cbiAgZm9yIChjb25zdCBtIG9mIE9iamVjdC5rZXlzKG1vZHVsZXMpKSB7XG4gICAgbGlua3MucHVzaChsaW5rTW9kdWxlKG0sIG1vZHVsZXNbbV0pKTtcbiAgfVxuXG4gIGF3YWl0IFByb21pc2UuYWxsKGxpbmtzKTtcblxuICByZXR1cm4gMDtcbn1cblxuaWYgKHJlcXVpcmUubWFpbiA9PT0gbW9kdWxlKSB7XG4gIChhc3luYyAoKSA9PiB7XG4gICAgcHJvY2Vzcy5leGl0Q29kZSA9IGF3YWl0IG1haW4ocHJvY2Vzcy5hcmd2LnNsaWNlKDIpLCBuZXcgUnVuZmlsZXMoKSk7XG4gIH0pKCk7XG59XG4iXX0=