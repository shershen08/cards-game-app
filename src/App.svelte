<script>
  import { Router, Link, Route } from "svelte-routing";
  import Main from "./routes/index.svelte";
  import About from "./routes/about.svelte";
  import { navigate } from "svelte-routing";

  import TopAppBar, {Row, Section, Title, FixedAdjust, DenseFixedAdjust, ProminentFixedAdjust, ShortFixedAdjust} from '@smui/top-app-bar';
  import IconButton from '@smui/icon-button';

  export let url = "";


  let dense = false;
  let prominent = false;
  let variant = 'standard';
  let collapsed = false;
  let title = 'Cards game';
  let Adjust = FixedAdjust;

</script>

<Router url="{url}">

<TopAppBar {dense} {prominent} {variant}>
  <Row>
    <Section on:click={() => navigate("/")}>
      <IconButton class="material-icons">menu</IconButton>
      <Title>{title}</Title>
    </Section>
    <Section align="end" toolbar>
        <Link to="about"><IconButton class="material-icons" aria-label="Bookmark this page">info</IconButton></Link>
    </Section>
  </Row>
</TopAppBar>
  <div style="padding-top:80px;">
    <Route path="about" component="{About}" />
    <Route path="/"><Main /></Route>
  </div>
</Router>

