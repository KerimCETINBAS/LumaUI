# Source converters

Converters turn an existing source value into data that another component can use. Create them in the Visual Editor's **Sources** tab, then select the result in the element's **Data → Property sources** controls.

LumaUI owns the editable `caseConverter` and `mathConverter` factories. wuira provides the typed callback `SourceConverter` used by those factories; formula parsing and case configuration are not SDK APIs.

## Map values with cases

Create a **Class** source with unit `$unit` inside a repeated member template, or `player` for a fixed unit. Create a **Case converter** that reads its `token` path. Each row matches a string, number or boolean using strict equality and returns a configured output. A default output handles unmatched values.

For example, these source definitions map class tokens to editable colors:

```json
[
  {
    "name": "memberClass",
    "type": "class",
    "props": { "unit": "$unit" }
  },
  {
    "name": "classColor",
    "type": "caseConverter",
    "props": {
      "source": "memberClass",
      "path": "token",
      "cases": [
        { "equals": "PALADIN", "value": { "r": 1, "g": 0.5, "b": 0.7, "a": 1 } },
        { "equals": "MAGE", "value": { "r": 0.2, "g": 0.5, "b": 1, "a": 1 } }
      ],
      "default": { "r": 0.35, "g": 0.4, "b": 0.45, "a": 1 }
    }
  }
]
```

Select `classColor` for **Background color** or **Border color**. Case outputs can also be numbers, strings, booleans or structured data. Match values retain their types: numeric `1` and string `"1"` are different cases. Duplicate matches in one converter are rejected.

## Transform numbers

Create a **Math converter**, select an input source and enter a formula such as `2 * input`. An optional input path selects a field inside an object. The formula is parsed once when the source is created.

```json
{
  "name": "doubledHealth",
  "type": "mathConverter",
  "props": {
    "source": "hp",
    "expression": "2 * input",
    "min": 0,
    "max": 2000
  }
}
```

The source named `hp` must already exist. Math converter output can drive a progress bar; its configured minimum and maximum define that bar's range.

Formulas support numbers, `input`, parentheses, unary `+`/`-`, and `+ - * / % ^ **`. They do not execute scripts or access functions or globals. Invalid formulas, division by zero and non-finite results are rejected.

## Bind appearance properties

The Data tab offers bindings for background color, border color and opacity, plus foreground color on progress bars. Select the source from the dropdown and optionally enter an output path. Paths are relative to the source's value: use `token` for a class value, or `r` for a color channel.

The equivalent node data is:

```json
"bindings": {
  "backgroundColor": { "source": "classColor" },
  "borderColor": { "source": "classColor" },
  "alpha": { "source": "classColor", "path": "a" }
}
```

Static property values serve as fallbacks when a converter has no output. Color bindings require RGB or RGBA objects; opacity requires a number between 0 and 1. **Save** commits edited output paths with the rest of the properties.

Bindings and converter definitions are saved and included in component import/export strings. Legacy class-color flags are converted into editable source definitions when a component is loaded.

## Lifetime and secure controls

Converters share their referenced sources and subscribe while consumers are listening. Removing a component releases its subscriptions. Converters do not poll or recreate native widgets for each value change.

Restricted inputs are checked before a conversion callback runs. Appearance updates reuse existing native regions. These bindings change presentation; protected actions, secure unit selection and native unit visibility retain their existing combat restrictions.
