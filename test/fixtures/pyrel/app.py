import os
import pkg.helper
import pkg.main as entry


def go():
    # Absolute intra-repo imports (import a.b / import a.b as c) plus an external one.
    return pkg.helper.build(os.getpid()) + entry.run()
