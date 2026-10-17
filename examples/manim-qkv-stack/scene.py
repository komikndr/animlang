"""A math-first explanation: row × column, three projections, then depth."""
import numpy as np
from manim import (
    ThreeDScene, VGroup, Text, Line, SurroundingRectangle,
    FadeIn, FadeOut, Write, Create, TransformFromCopy, ReplacementTransform,
    LaggedStart, UP, DOWN, RIGHT, DEGREES,
)

BLUE, YELLOW, GREEN = "#58C4DD", "#FFFF00", "#83C167"
WHITE, GRAY = "#EEEEEE", "#999999"

# The browser examples use row tokens. These transposes use column tokens.
X = np.array([[1, 0, 2], [0, 2, 1], [-1, 1, 0], [2, -1, 1]])
WEIGHTS = [
    np.array([[1, 0, 1, -1], [0, 1, 1, 0], [1, -1, 0, 1]]),
    np.array([[0, 1, -1, 1], [1, 0, 1, -1], [0, 1, 0, 1]]),
    np.array([[1, 0, 1, 0], [0, 1, -1, 1], [-1, 1, 0, 1]]),
]


def words(value, size=28, color=WHITE, math=False):
    return Text(value, font="DejaVu Serif" if math else "DejaVu Sans",
                font_size=size, color=color)


def symbol(base, subscript=None, color=WHITE, size=36):
    main = words(base, size, color, math=True)
    if subscript is None:
        return VGroup(main)
    sub = words(subscript, size*0.5, color, math=True)
    sub.next_to(main, RIGHT, buff=0.035).shift(DOWN*0.17)
    return VGroup(main, sub)


def matrix(data, cell=0.6, color=WHITE):
    rows, cols = data.shape
    entries = VGroup(*[
        words(str(data[r, c]), 28, color, math=True).move_to(
            [(c-(cols-1)/2)*cell, ((rows-1)/2-r)*cell, 0.01])
        for r in range(rows) for c in range(cols)
    ])
    x, y = cols*cell/2+0.07, rows*cell/2+0.03
    brackets = VGroup()
    for side in [-1, 1]:
        brackets.add(VGroup(
            Line([side*x, -y, 0], [side*x, y, 0]),
            Line([side*x, y, 0], [side*(x-0.15), y, 0]),
            Line([side*x, -y, 0], [side*(x-0.15), -y, 0]),
        ).set_stroke(color, width=2))
    return VGroup(entries, brackets)


class QKVStack(ThreeDScene):
    def construct(self):
        self.camera.background_color = "#000000"
        self.set_camera_orientation(phi=0, theta=-90*DEGREES)
        colors = [BLUE, YELLOW, GREEN]

        title = words("One input, three perspectives", 39).move_to(UP*3.05)
        self.play(Write(title), run_time=1.2)
        x = matrix(X).move_to([-0.2, 0.35, 0])
        x_label = symbol("X", color=BLUE).next_to(x, UP, buff=0.25)
        tokens = words("three tokens", 20, GRAY).next_to(x, DOWN, buff=0.3)
        self.play(FadeIn(x), Write(x_label), FadeIn(tokens), run_time=1)
        self.wait(0.8)

        w = matrix(WEIGHTS[0]).move_to([-4.2, 0.35, 0])
        w_label = symbol("W", "Q", BLUE).next_to(w, UP, buff=0.25)
        q = matrix(WEIGHTS[0] @ X).move_to([4.2, 0.35, 0])
        q_label = symbol("Q", color=BLUE).next_to(q, UP, buff=0.25)
        times = words("×", 38).move_to([-2.2, 0.35, 0])
        equals = words("=", 38).move_to([2, 0.35, 0])
        self.play(FadeIn(w), Write(w_label), Write(times), Write(equals),
                  Create(q[1]), Write(q_label), FadeOut(tokens), run_time=1.5)

        row = VGroup(*w[0][:4])
        column = VGroup(*[x[0][r*3] for r in range(4)])
        row_box = SurroundingRectangle(row, color=YELLOW, buff=0.12, stroke_width=2)
        column_box = SurroundingRectangle(column, color=BLUE, buff=0.13, stroke_width=2)
        self.play(Create(row_box), Create(column_box), row.animate.set_color(YELLOW),
                  column.animate.set_color(BLUE), run_time=0.7)

        # Move actual matrix entries into four products, rather than show a static caption.
        terms = VGroup()
        sources, targets = [], []
        for i, (a, b) in enumerate(zip(WEIGHTS[0][0], X[:, 0])):
            left = words(f"({a})", 30, YELLOW, math=True)
            right = words(f"({b})", 30, BLUE, math=True)
            term = VGroup(left, words("·", 30), right).arrange(RIGHT, buff=0.06)
            terms.add(term)
            sources.extend([row[i], column[i]])
            targets.extend([left, right])
        calculation = VGroup()
        for i, term in enumerate(terms):
            if i:
                calculation.add(words("+", 28, GRAY))
            calculation.add(term)
        calculation.arrange(RIGHT, buff=0.18).move_to(DOWN*2)
        punctuation = VGroup(*[item for item in calculation if item not in terms],
                             *[term[1] for term in terms])
        self.play(*[TransformFromCopy(a, b) for a, b in zip(sources, targets)],
                  FadeIn(punctuation), run_time=1.5)
        self.wait(0.8)
        result = words("−2", 40, BLUE, math=True).move_to(calculation)
        self.play(ReplacementTransform(calculation, result), run_time=1)
        self.play(TransformFromCopy(result, q[0][0]), run_time=0.8)
        self.play(LaggedStart(*[FadeIn(entry, shift=UP*0.08) for entry in q[0][1:]], lag_ratio=0.12),
                  FadeOut(result), FadeOut(row_box), FadeOut(column_box),
                  row.animate.set_color(WHITE), column.animate.set_color(WHITE), run_time=1.6)
        # Gather entries that individual animations added under one matrix parent.
        self.remove(*q.get_family())
        self.add(q)
        self.wait(0.6)

        self.play(FadeOut(w), FadeOut(w_label), FadeOut(times), FadeOut(equals),
                  FadeOut(x), FadeOut(x_label), FadeOut(title), run_time=1)
        projections = [q]
        labels = [q_label]
        self.play(q.animate.move_to([-3.9, 0, 0]), q_label.animate.move_to([-3.9, 1.55, 0]), run_time=1.5)
        heading = words("Same X. Different learned weights.", 31).move_to(UP*3.05)
        self.play(FadeIn(heading), run_time=0.8)

        for i, letter in [(1, "K"), (2, "V")]:
            center = 0 if i == 1 else 3.9
            output = matrix(WEIGHTS[i] @ X).move_to([center, 0, 0])
            label = symbol(letter, color=colors[i]).move_to([center, 1.55, 0])
            formula = VGroup(symbol("W", letter, colors[i], 28), symbol("X", color=BLUE, size=28))
            formula.arrange(RIGHT, buff=0.12).move_to([center, -1.65, 0])
            self.play(Write(formula), run_time=0.6)
            self.play(LaggedStart(*[FadeIn(entry) for entry in output[0]], lag_ratio=0.06),
                      Create(output[1]), Write(label), run_time=1.4)
            projections.append(output)
            labels.append(label)
            self.remove(*output.get_family())
            self.add(output)
            self.play(FadeOut(formula), run_time=0.4)
        self.wait(1)

        self.play(FadeOut(heading), run_time=0.6)
        heading = words("Give the three matrices a depth axis.", 30).move_to(UP*3.1)
        self.add_fixed_in_frame_mobjects(heading)
        self.play(FadeIn(heading), run_time=0.8)

        # Move labels with their slices. All entries remain the numerical products.
        slices = []
        for i, (projection, label) in enumerate(zip(projections, labels)):
            self.remove(projection, label)
            self.add(projection, label)
            # A faint boundary makes each plane legible without cell boxes or UI panels.
            boundary = SurroundingRectangle(projection, buff=0.14, color=colors[i],
                                            stroke_width=1.2, fill_color=colors[i], fill_opacity=0.055)
            self.add(boundary)
            projection[1].set_color(colors[i])
            slices.append(VGroup(projection, boundary))
        self.move_camera(phi=64*DEGREES, theta=-63*DEGREES, zoom=1.12,
                         added_anims=[
                             *[slab.animate.move_to([0, 0, (i-1)*1.7]) for i, slab in enumerate(slices)],
                             *[label.animate.move_to([-1.65, 0, (i-1)*1.7]) for i, label in enumerate(labels)],
                         ], run_time=3)
        connectors = VGroup(*[
            Line([a, b, -1.7], [a, b, 1.7], color="#666666", stroke_width=1)
            for a in [-1.17, 1.17] for b in [-1.07, 1.07]
        ])
        self.play(Create(connectors), run_time=0.8)
        self.move_camera(theta=-48*DEGREES, run_time=3)
        stack_label = words("stack(Q, K, V)     →     3 × 3 × 3", 29).move_to(DOWN*3)
        self.add_fixed_in_frame_mobjects(stack_label)
        self.play(Write(stack_label), run_time=1.2)
        self.wait(2.4)
