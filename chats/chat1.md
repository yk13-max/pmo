# Project management office tracker

_Started 2026-08-05 08:45 UTC_

---

## User

Make UI mockups for project management office tracker. There are two distinct types of projects, client solutions and CDMO, under each type there are internal and customer-facing projects. They all have distinct budgets, timelines and if customer-facing value/invoice amount. There needs to be conideration of resource levels across the teams.

## Assistant

## Assistant

## Assistant

## Assistant

## Assistant



## Assistant

_[tool: ask_user]_

Waiting on your answers — mainly the design direction, which screens to start with, and how the portfolio should be organized.

## User

Answered — Asked for follow-up questions; design_system: Picked a design system (now attached); primary_user: PMO lead / head of delivery, Project manager running 2–5 projects, Exec / leadership reviewing portfolio, Resource or capacity manager, Finance / commercial team; first_screens: Portfolio overview (all projects, both types), Single project detail, Resource / capacity view across teams, Financials — budget vs actual vs invoiced, Timeline / Gantt roadmap, Alerts & risk queue; portfolio_shape: option_3; resource_grain: Team-level %; health_signal: Budget burn vs plan, Resource over-alloc…

## Assistant



## Assistant

_[tool: ask_user]_

Round 2 is up — build order, how the 2×2 groups on the grid, and your role pools.

## User

Answered — Asked for follow-up questions; build_order: Portfolio overview — card grid, both types, Resource / capacity across role pools, Financials — budget vs actual vs invoiced; grid_grouping: Flat + filters; roles: Process engineer, Project manager, Design engineer, Regulatory support; overallocation: Soft threshold ~85%

## Assistant



## Assistant

_[tool: ask_user]_

Round 3 is up — card contents, filters, and financials focus.

## User

Answered — Asked for follow-up questions; card_content: Project name + client, Internal vs customer-facing marker, Timeline / phase progress, Next milestone + date, Invoice value & amount billed, Team resource load indicator; filters: Type (CS / CDMO), Status / RAG, PM owner; fin_focus: Per-project table; density: Balanced

## Assistant



## Assistant

_[tool: ask_user]_

Round 4 is up — internal/customer-facing marker, the money slot on internal cards, and your phase names.

## User

Answered — Asked for follow-up questions; internal_marker: Left edge stripe; internal_money: Show budget drawn; resource_indicator: Single load %; phase_labels: CS - Production Trial, V&V, Sterlisation (optional)
CDMO - Pre-Project, Planning & Feasibility, Design Inputs, Design Outputs, Product & Process V&V. Production & Market Readiness. Product Launch & P…

## Assistant



## Assistant

_[tool: ask_user]_

Round 5 is up — CS phase list, design width, and where RAG status comes from. After this I'll build.

## User

Answered — Asked for follow-up questions; cs_phases: Add a handover phase after; viewport: Both; rag_rule: PM sets it manually

## Assistant

## Assistant



## Assistant



## Assistant

_[tool: ask_user]_

## Assistant

Round 6 — nav shell and sample-data style. That's the last of it; I'll build after.

## User

Answered — nav: Sidebar + top filter bar; data_realism: Invent plausible names

## Assistant

## Assistant

## Assistant

_[tool: list_files]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

## Assistant

_[tool: read_file]_

Design system is Broadsheet (newsprint serif, paper ground, cyan/magenta spot). Copying its stylesheet in, then building the three screens.

_[tool: copy_files]_

_[tool: dc_write]_

_[tool: ready_for_verification]_

Built on Broadsheet — paper ground, serif chrome, cyan for customer-facing and magenta reserved for at-risk. Three screens live via the sidebar: Portfolio (45 cards, flat grid + type/status/owner filters, internal marked by the pale left stripe), Resource pools (4 role pools × 6 months heatmap plus a pressure-points table), and Financials (customer-facing contract/invoice table + internal draw-down table). The over-allocation threshold is a tweak, defaulted to 85%.

Timeline, project detail and alerts are stubs — say which one next.

## User

revise with an airy layout, reduce the number of project managers to 4 people. 1 regulatory rep, 1 process engineer, 1 design engineer. There are 6 CDMO projects, name them after prominent of mountains and 22 CS Projects which can be named after prominent rainforests.

Make graphics more of a priority the design

## Assistant

Rebuilding as v2 with the smaller team, mountain/rainforest naming, and charts as the lead — keeping v1 intact.

_[tool: dc_write]_

_[tool: ready_for_verification]_

## User

mock up the rest of the portfolio tracker, add labels to any graph axis, simplify layout and info for the layman to gain an understanding

## Assistant

Adding the three remaining screens, axis labels, and plainer language.

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

Now the three remaining screens.

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

## User

Found issues — fixing…

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the template: labels move out of SVG into positioned HTML.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

All six screens are in now: Portfolio, Timeline, Project detail, Financials, Resourcing, Alerts.

- Chart labels moved out of SVG into positioned HTML so tick values, project names and month labels actually render; both charts now carry titled axes and a plain-English legend.
- Timeline diamonds now sit on each project's real next-milestone date.
- Copy simplified throughout: "people needed" instead of FTE, "spent so far", "still to invoice", "budget used".
- Project detail is switchable via the dropdown — phase stepper, spend bar, four-stage invoice schedule, per-person allocation, and a plain "what to watch" note.

## User

Found issues — fixing…

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

## User

Found issues — fixing…

## Assistant

Root cause: the remaining axis titles/captions are SVG `<text>`, which scales with the 1040-unit viewBox (0.558× at preview width) while the tick labels are fixed-px HTML — so titles paint at ~6px and collide. Fix: no text inside either SVG at all.

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the demand chart, same treatment.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

## User

change all CDMO projects to name of prominent watch brands, change all CS projects to the name to F1 teams

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

## User

there is an issue withj hovering over the internal projects as the line/area is very thin

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

## User

remove static labels from the plot

## Assistant

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

Static point labels removed — the plot is now clean circles, with names and figures coming from the hover snapshot. Added a legend line saying so.

## User

show the shortfall graph under the person by person

## Assistant

_[tool: grep]_

_[tool: run_script]_

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

## User

in the timeline section show the timeline in quarters rather than months, and the due date when hovering over the next thing due and the end of the project and the start of the project, hovering also shows the the team working on the project.

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: run_script]_

Now the graphical Alerts screen.

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

## User

show a mini graphic adjacent to the 4 metrics on the Portfolio page to keep the viewer engaged yet with subtlety

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

## User

Found issues — fixing…

## Assistant

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

## User

check the durations when hovering on the timelines, show subtle separation lines per quarter too, make the pop out, align with the end of the line. Align CS projects in 2 columns. Tweak all resource levels so only a 2-3 people are over resourced, show the shortfall of 1 person

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: grep]_

_[tool: dc_js_str_replace]_

Now durations, tooltip alignment, quarter lines, and the CS two-column layout.

_[tool: dc_js_str_replace]_

_[tool: run_script]_

_[tool: run_script]_

_[tool: ready_for_verification]_

## User

Found issues — fixing…

## Assistant

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

## User

Found issues — fixing…

## Assistant

_[tool: dc_js_str_replace]_

_[tool: run_script]_

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

## User

show some people within the 85% threshold on resource

## Assistant

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

## User

make axis font larger and easier to read

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

## User

Found issues — fixing…

## Assistant

_[tool: run_script]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

## User

Have the CS projects no longer sit side by side on the timeline page

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

## User

Change PM names to Saranan, Andy, Neil and Toby, Change Regs to Carrie, Change Design to Anna, change process to Josh

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

Team renamed throughout — Saranan, Andy, Neil and Toby on projects; Josh (process), Anna (design), Carrie (regulatory).

## User

make it so you can hover on the mini resource graphs, the percentage level can be seen

## Assistant

_[tool: dc_js_str_replace]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

Now the PM assignment rule.

_[tool: dc_js_str_replace]_

## Assistant

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

## User

Found issues — fixing…

## Assistant

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

Fixed — the busiest-person line now reads "Neil, project manager (CS), in Oct".

## User

over budgets nearly gone, it shows the budgets that are

## Assistant

Not sure I follow — the "Budgets nearly gone" list currently shows any project that has spent more than 95% of its approved budget. Do you want it to:

- show only the ones fully spent (100%+), or
- split into "nearly gone" vs "already gone", or
- widen the threshold (say 85%+) so more show?

Tell me which and I'll change it.

## User

Under financials the 4th metric reads as 1, this is the text underneath it

## Assistant

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

That metric's caption now names the project instead of restating the rule — "Taman Negara at 97% spent". If you meant something else by the text underneath it, say what it should read.

## User

make the filter on the portfolio page also affect the chart

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

## User

Check didn’t complete

## Assistant

The chart now plots only the filtered set — chips and owner dropdown drive both the plot and the cards, and the hover snapshot clears if its project gets filtered out.

## User

On the portfolio page what does 8 short of people mean?

## Assistant

It counts projects, not people: 8 of the 28 projects depend on someone already booked past 85% of their week — so they're at risk of slipping for lack of capacity, not money.

The label is doing a poor job of saying that. Better wording: "Projects short of people", with the caption "Rely on someone booked past 85%". Want me to change it?

## User

Save as standalone HTML: `PMO Tracker v2.dc.html`

## Assistant

_[tool: copy_files]_

_[tool: grep]_

_[tool: dc_html_str_replace]_

_[tool: super_inline_html]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: present_fs_item_for_download]_

Bundled to a single 562 KB file — stylesheet, runtime and the Source Serif webfont all inlined, works offline with no dependencies.

