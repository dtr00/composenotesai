import { Checkbox } from "../../../shared/ui/checkbox";

interface TaskCheckboxProps {
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}

export function TaskCheckbox({ checked, disabled, onToggle }: TaskCheckboxProps) {
  return (
    <Checkbox
      aria-label="Done"
      checked={checked}
      disabled={disabled}
      onCheckedChange={onToggle}
      onMouseDown={(event) => event.preventDefault()}
    />
  );
}
