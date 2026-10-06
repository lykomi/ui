import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Checkbox, Field, Input, ReadOnlyField } from "@iloveagents/foundry-web-primitives";

it("associates help and errors while keeping field actions outside the control label", () => {
  const html = renderToStaticMarkup(
    <Field
      label="Email"
      hint="Work email"
      error="Enter a valid email"
      action={<button type="button">Use another address</button>}
    >
      <Input />
    </Field>,
  );
  const id = html.match(/<input[^>]*\sid="([^"]+)"/)?.[1];
  expect(id).toBeTruthy();
  expect(html).toContain(`for="${id}"`);
  expect(html).toContain('aria-invalid="true"');
  expect(html).toMatch(/aria-describedby="[^"]+-hint [^"]+-error"/);
  expect(html).not.toMatch(/<label[^>]*>[^<]*<button/);
  expect(html).toMatch(/<\/label><button/);
});

it("associates single controls supplied through transparent arrays and fragments", () => {
  for (const control of [
    [<Input key="input" required />],
    <>
      <Input required />
    </>,
    <>
      {[
        null,
        <>
          <Input required />
        </>,
      ]}
    </>,
  ]) {
    const html = renderToStaticMarkup(
      <Field label="Name" hint="Team name" error="Enter a name">
        {control}
      </Field>,
    );
    const id = html.match(/<input[^>]*\sid="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`for="${id}"`);
    expect(html).toContain("(Required)");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toMatch(/aria-describedby="[^"]+-hint [^"]+-error"/);
  }
});

it("preserves boolean values inside ordinary styled and linked reading elements", () => {
  for (const value of [false, true]) {
    const html = renderToStaticMarkup(
      <ReadOnlyField label="Enabled">
        <a href="/details">
          <span>{value}</span>
        </a>
      </ReadOnlyField>,
    );
    expect(html).toContain(`<span>${value}</span>`);
    expect(html).toContain('href="/details"');
    expect(html).not.toContain("Not set");
  }
});

describe("existing Field forms", () => {
  it("shows a quiet requirement from the native control without adding it to the accessible name", () => {
    const html = renderToStaticMarkup(
      <Field label="Email">
        <Input required />
      </Field>,
    );
    expect(html).toContain("(Required)");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('required=""');
    expect(
      renderToStaticMarkup(
        <Field label="Notes">
          <Input />
        </Field>,
      ),
    ).not.toContain("(Required)");
  });
  it("retains an explicit target and existing descriptions", () => {
    const html = renderToStaticMarkup(
      <Field label="Name" htmlFor="person" hint="Team name">
        <Input aria-describedby="extra" />
      </Field>,
    );
    expect(html).toContain('id="person"');
    expect(html).toContain('for="person"');
    expect(html).toMatch(/aria-describedby="extra [^"]+-hint"/);
  });
});

it("renders read-only content as a labelled, copyable value with usable links", () => {
  const html = renderToStaticMarkup(
    <ReadOnlyField label="Owner" hint="Responsible for the next step.">
      <a href="mailto:alex@example.com">Alex Morgan</a>
    </ReadOnlyField>,
  );
  expect(html).toContain("<dt");
  expect(html).toContain("Owner</dt>");
  expect(html).toContain('href="mailto:alex@example.com"');
  expect(html).toContain("Responsible for the next step.");
  expect(html).not.toMatch(/<(input|textarea|button|label)\b/);
});

it("read-only empty values are explicit while zero and false remain real values", () => {
  expect(renderToStaticMarkup(<ReadOnlyField label="Owner">{null}</ReadOnlyField>)).toContain(
    "Not set",
  );
  const zero = renderToStaticMarkup(<ReadOnlyField label="Count">{0}</ReadOnlyField>);
  expect(zero).toContain(">0</dd>");
  expect(zero).not.toContain("Not set");
  expect(renderToStaticMarkup(<ReadOnlyField label="Enabled">{false}</ReadOnlyField>)).toContain(
    ">false</dd>",
  );
});

it("shows an explicit empty label for empty and nested child collections", () => {
  for (const value of [[], [null, undefined, ""], [[], [null]]]) {
    const html = renderToStaticMarkup(
      <ReadOnlyField label="Teams" emptyLabel="No teams">
        {value}
      </ReadOnlyField>,
    );
    expect(html).toContain("No teams");
  }
  expect(
    renderToStaticMarkup(
      <ReadOnlyField label="Teams">{[<span key="team">Platform</span>]}</ReadOnlyField>,
    ),
  ).toContain("Platform");
});

it("associates the public checkbox with its label, help and validation error", () => {
  const html = renderToStaticMarkup(
    <Field label="Consent" hint="Choose whether to receive updates" error="Confirm your preference">
      <Checkbox />
    </Field>,
  );
  const control = html.match(/<button[^>]*role="checkbox"[^>]*>/)?.[0];
  expect(control).toBeTruthy();
  expect(control).toMatch(/aria-describedby="[^"]+-hint [^"]+-error"/);
  expect(control).toContain('aria-invalid="true"');
  const id = control?.match(/\sid="([^"]+)"/)?.[1];
  expect(html).toContain(`for="${id}"`);
});

it("uses the empty label for fragment-wrapped collections while retaining populated fragments", () => {
  const html = renderToStaticMarkup(
    <ReadOnlyField label="Teams">
      <>
        {[].map(() => (
          <span>Team</span>
        ))}
      </>
    </ReadOnlyField>,
  );
  expect(html).toContain("Not set");
  expect(
    renderToStaticMarkup(
      <ReadOnlyField label="Teams">
        <>
          <span>Platform</span>
        </>
      </ReadOnlyField>,
    ),
  ).toContain("Platform");
});

it("preserves boolean data and zero through arrays and fragments", () => {
  for (const value of [false, true, 0]) {
    for (const wrapped of [[value], <>{value}</>, [<>{[value]}</>]]) {
      const html = renderToStaticMarkup(<ReadOnlyField label="Value">{wrapped}</ReadOnlyField>);
      expect(html).toContain(`>${String(value)}</dd>`);
      expect(html).not.toContain("Not set");
    }
  }
});
