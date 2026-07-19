from .helper import build
from .missing import nope


def run():
    return build(nope())
