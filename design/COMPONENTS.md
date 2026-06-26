# AmazeCC Components

---

## 1. Buttons

Buttons are used to trigger actions. They must have clear visual hierarchies and standard states.

### Variants
* **Primary Button**: 
  - *Purpose*: Main call-to-action on a screen or modal.
  - *Styling*: Solid theme accent color background, high contrast text (white or light/dark contrast depending on accent).
  - *States*:
    - Default: Solid background.
    - Hover: Slightly darker/brighter tone (transition: 150ms fast).
    - Focus: Visible focus ring (2px gap, 2px theme color outline).
    - Disabled: 50% opacity, `cursor: not-allowed`, pointer-events disabled.
* **Secondary Button**:
  - *Purpose*: Alternatives to the primary action.
  - *Styling*: Outlined with the neutral border color or a light tint of the neutral surface, text color is primary text or accent.
  - *States*:
    - Default: Clean border, transparent background.
    - Hover: Subtle background tint (e.g., neutral hover surface, transition: 150ms).
    - Focus: Visible focus ring.
    - Disabled: Greyed-out border and text, pointer-events disabled.
* **Ghost Button**:
  - *Purpose*: Low emphasis actions, toolbar options, and inline auxiliary functions.
  - *Styling*: No background or border. Text color is secondary text or primary text.
  - *States*:
    - Default: Transparent background.
    - Hover: Light gray surface tint or light accent tint.
    - Focus: Inner border or focus ring.
    - Disabled: Lower opacity, pointer-events disabled.
* **Danger Button**:
  - *Purpose*: Destructive actions (delete, reset, remove).
  - *Styling*: Solid danger semantic background (red), white/high-contrast text.
  - *States*:
    - Default: Solid danger red background.
    - Hover: Darker red background.
    - Focus: Danger focus ring.
    - Disabled: Greyed-out background, pointer-events disabled.

---

## 2. Cards

Cards organize content into distinct, readable units. All cards use `Shadow Small` and a `Medium Radius (16px)`.

### Variants
* **Metric Card**:
  - *Purpose*: Displays key data points or stats (e.g., "Attendance: 85%", "GPA: 3.8").
  - *Structure*: Large display number, a short caption/label, and optional trend/semantic indicator.
* **Content Card**:
  - *Purpose*: Displays general text, lists, or media.
  - *Structure*: Padding (16px or 24px), clear heading (Subheading scale), body copy, and optional footer.
* **Action Card**:
  - *Purpose*: Serves as an interactive button/panel to trigger navigation or commands.
  - *Structure*: Contains a title, description, leading Lucide icon, and a trailing arrow/chevron icon.
  - *States*: Hover changes background to elevated surface and increases shadow depth to Shadow Medium.

---

## 3. Badges

Badges show status or category labels.

### Variants
* **Success Badge**: Light success background, dark success text. Used for "Present", "Completed".
* **Warning Badge**: Light warning background, dark warning text. Used for "Late", "Pending".
* **Danger Badge**: Light danger background, dark danger text. Used for "Absent", "Failed".
* **Info Badge**: Light info background, dark info text. Used for "Announcements", "Optional".

---

## 4. Menu

Menus list selectable options or commands in a compact panel.

### Structure
* **Container**: Employs `Surface` or `Elevated Surface`, `Shadow Medium`, and `Small Radius (12px)`.
* **Menu Items**:
  - Pad: 12px horizontal, 8px vertical.
  - Icon: Left-aligned Lucide icon (16x16px) with secondary text color.
  - Text: Body or Caption typography scale.
  - Active/Hover State: Background transitions to neutral hover/surface tint, text transitions to primary.
* **Separators**: 1px solid border color between groups of menu items.

---

## 5. Slider

Sliders allow users to select a single value from a range.

### Structure
* **Track**: Horizontal bar, 4px height. Light neutral border color background.
* **Filled Track**: Portion of track from min value to current thumb position, using the theme accent color.
* **Thumb**: Round handle (16px x 16px or 20px x 20px for touch accessibility), using solid white background with a thin border and `Shadow Small`.
* **Interaction**:
  - Hover: Thumb grows slightly or shows cursor pointer.
  - Focus: Focused thumb exhibits a surrounding focus ring.
  - Active: Dragging shows tooltip indicating current value.

---

## 6. Dropdown / Select

Dropdowns allow selection from a list of options when space is limited.

### Structure
* **Trigger Field**:
  - Similar style to text inputs (Medium Radius, border, primary text).
  - Contains the selected option label, and a trailing chevron-down icon.
* **Popover Panel**:
  - Floats below or above trigger. Align horizontally with the trigger.
  - Uses `Elevated Surface` background, `Shadow Medium`, and `Small Radius (12px)`.
  - Max height: 250px (scrollable if content overflows).
* **Selection State**: Selected item inside list exhibits a checkmark icon on the right or a background tint.

---

## 7. Popups / Modals / Dialogs

Popups overlay the main interface to present high-priority tasks or messages.

### Structure
* **Backdrop**: Semi-transparent dark overlay (e.g., 40% opacity black) with light backdrop-blur (4px) to keep focus on the modal.
* **Container**:
  - Uses `Elevated Surface` background, `Large Radius (24px)`, and `Shadow Large`.
  - Max width ranges: Small/Alert (400px), Standard (600px), Large (800px).
* **Layout**:
  - **Header**: Contains title (Heading scale), description (Caption scale), and a close button (Ghost variant with X icon) in the top-right corner.
  - **Body**: Scrollable contents, uses standard margins.
  - **Footer**: Sticky to the bottom, containing actions. Primary action is always on the right/end, secondary on the left/start of actions.
* **Accessibility**: Must handle Esc key to close, trap keyboard focus within the dialog, and return focus to the trigger on close.

---

## 8. Form Inputs

Input controls for data entry.

### Text Inputs / Textarea
* **Styling**: 
  - Height: 40px for inputs. Textareas are variable height.
  - Border: 1px neutral border.
  - Radius: `Small Radius (12px)`.
  - Text: Geist/Inter body or caption text, with a placeholder in secondary text color.
* **States**:
  - Hover: Darker border.
  - Focus: 2px solid theme accent color outline.
  - Error: 1.5px solid danger red border, with accompanying error text beneath.

### Checkbox & Radio
* **Size**: 18px x 18px box (Checkbox) or circle (Radio).
* **States**:
  - Unchecked: Outlined neutral border.
  - Checked: Solid theme accent background with checkmark (Checkbox) or center dot (Radio).
  - Touch Target: Surrounding area must provide a minimum 44px x 44px touch area.

### Switch (Toggle)
* **Structure**: Rounded pill track (36px width, 20px height) and round thumb (16px x 16px).
* **States**:
  - Off: Light neutral track, thumb positioned left.
  - On: Theme accent track, thumb positioned right.

---

## 9. Tooltips
 
 Small text labels that appear on hover or focus of an element.
 
 ### Structure
 * **Background**: Dark neutral surface (almost black) or solid accent color.
 * **Text**: Small label scale (12px), white/high-contrast text.
 * **Border Radius**: `Small Radius (12px)` or custom micro-radius (4px-8px).
 * **Timing**: Appears after a 500ms delay, fades out instantly. No click interaction.
 
 ---
 
 ## 10. Page Header Container
 
 The Page Header Container encloses the page's primary title, simulated summaries, and page-level actions inside a cohesive card structure.
 
 ### Structure
 * **Container**:
   - Uses flat Material-like pastel colors (e.g., `bg-indigo-50/40` in light mode, `bg-indigo-950/20` in dark mode) to create a soft, clean UI block.
   - Configured in a **Semi-Pill format** originating from the top (`rounded-b-2xl`) with no gradient overlays to maintain a flat, modern aesthetic.
   - Generously proportioned with custom vertical and horizontal paddings (`py-4.5 px-6`) and a subtle shadow (`shadow-sm`) to stand out.
 * **Layout**:
   - **Metas & Title**: Uses the Display & Heading font (`Outfit`) in `font-black` weight to highlight the primary title (e.g., "Weekly attendance"), paired with inline simulation metrics for immediate feedback.
   - **Action Buttons**: Expanded in size to match the header container (`px-3.5 py-2` padding, `text-[11px] font-extrabold` caps, `w-4 h-4` icons) to maintain balance.
   - **Responsive**: Adapts gracefully to narrower viewports, preserving paddings and layout alignment.
