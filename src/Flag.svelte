<script>
  import { isoToCountryCode, imageUrl } from 'flagpack-core'

  export let code = "NL"
  export let size = "m"

  const url = imageUrl(isoToCountryCode(code).toUpperCase(), size.toLowerCase()).default
</script>

<div>
  {@html url}
</div>
